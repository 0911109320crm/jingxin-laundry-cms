"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";

export type Res = { ok: true } | { ok: false; error: string };

/**
 * 老闆娘從待派案頁一鍵指派某位師傅：
 *   - 把該訂單所有 order_items.technician_id 設為該師傅
 *   - 若原本 status='pending' → 升為 'scheduled'
 */
export async function assignTechnicianAction(
  orderId: string,
  technicianId: string,
): Promise<Res> {
  await requireRole(["owner"]);
  const supabase = await createClient();

  const { error: iErr } = await supabase
    .from("order_items")
    .update({ technician_id: technicianId })
    .eq("order_id", orderId);
  if (iErr) return { ok: false, error: iErr.message };

  // 若還是 pending，升為 scheduled（保留 scheduled_at；沒填就維持空）
  const { data: o } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();
  if ((o as { status: string } | null)?.status === "pending") {
    const { error } = await supabase
      .from("orders")
      .update({ status: "scheduled" })
      .eq("id", orderId);
    if (error) return { ok: false, error: error.message };
  }

  await logAudit({
    action: "manager.assign_technician",
    target_type: "order",
    target_id: orderId,
    payload: { technician_id: technicianId },
  });

  revalidatePath("/manager/pending");
  revalidatePath("/manager/schedule");
  revalidatePath("/manager");
  revalidatePath("/calendar");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}
