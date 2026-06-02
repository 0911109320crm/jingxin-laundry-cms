"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

type Res = { ok: boolean; error?: string; realId?: string };

/** 老闆娘在待回繳頁登記某師傅的代墊支出（加油、停車費…）。 */
export async function addTechnicianExpenseAction(
  technicianId: string,
  name: string,
  amount: number,
): Promise<Res> {
  const me = await requireRole(["owner", "manager"]);
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "請填支出項目名稱" };
  if (!Number.isFinite(amount) || amount < 0)
    return { ok: false, error: "金額需為 0 以上的數字" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_expenses")
    .insert({
      technician_id: technicianId,
      name: trimmed.slice(0, 100),
      amount,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/payroll/settlements");
  return { ok: true, realId: (data as { id: string }).id };
}

/** 刪除一筆代墊支出。 */
export async function removeTechnicianExpenseAction(id: string): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("technician_expenses")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/payroll/settlements");
  return { ok: true };
}

/** 標記某筆代墊支出為「已沖銷」(老闆娘已用回繳現金抵掉)；可再切回未沖銷。 */
export async function setExpenseReimbursedAction(
  id: string,
  reimbursed: boolean,
): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("technician_expenses")
    .update({
      is_reimbursed: reimbursed,
      reimbursed_at: reimbursed ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/payroll/settlements");
  return { ok: true };
}
