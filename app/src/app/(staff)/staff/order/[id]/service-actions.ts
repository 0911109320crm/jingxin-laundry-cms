"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentUser } from "@/lib/dal";

export type Res = { ok: true } | { ok: false; error: string };

const SwapSchema = z.object({
  order_id: z.string().uuid(),
  order_item_id: z.string().uuid(),
  service_item_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

/**
 * 師傅在現場把「老闆娘建單時的基本品項」換成實際看到的 service_item。
 * 同時帶入該 service_item 的 default_price 重算 subtotal，
 * trigger refresh_order_totals 會自動更新 orders.total。
 */
export async function swapOrderItemServiceAction(input: {
  order_id: string;
  order_item_id: string;
  service_item_id: string;
  quantity: number;
}): Promise<Res> {
  const me = await requireRole(["technician", "owner", "manager"]);
  const parsed = SwapSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();

  // technician 只能改自己負責的 order_item
  if (me.profile.role === "technician") {
    const { data: owns } = await supabase
      .from("order_items")
      .select("id")
      .eq("id", parsed.data.order_item_id)
      .eq("technician_id", me.id)
      .limit(1);
    if (!Array.isArray(owns) || owns.length === 0) {
      return { ok: false, error: "不是你負責的明細" };
    }
  }

  // 取新 service_item 的 default_price
  const { data: svc, error: svcErr } = await supabase
    .from("service_items")
    .select("default_price, active")
    .eq("id", parsed.data.service_item_id)
    .single();
  if (svcErr || !svc) return { ok: false, error: "找不到服務項目" };
  const svcRow = svc as { default_price: number; active: boolean };
  if (!svcRow.active) return { ok: false, error: "此服務項目已停用" };

  const unitPrice = Number(svcRow.default_price);
  const subtotal = unitPrice * parsed.data.quantity;

  // technician 經 RLS 不能直接 update order_items，用 admin
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("order_items")
    .update({
      service_item_id: parsed.data.service_item_id,
      quantity: parsed.data.quantity,
      unit_price: unitPrice,
      subtotal,
    })
    .eq("id", parsed.data.order_item_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/staff/order/${parsed.data.order_id}`);
  revalidatePath(`/orders/${parsed.data.order_id}`);
  return { ok: true };
}
