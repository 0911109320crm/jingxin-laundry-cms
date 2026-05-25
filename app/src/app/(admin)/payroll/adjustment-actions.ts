"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, getCurrentUser } from "@/lib/dal";

const AddSchema = z.object({
  technician_id: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "月份格式錯誤 (YYYY-MM)"),
  type: z.enum(["bonus", "deduction"]),
  amount: z.coerce.number().positive("金額需大於 0"),
  reason: z.string().min(1, "請填原因").max(200),
});

export type Res = { ok: true } | { ok: false; error: string };

export async function addPayrollAdjustment(fd: FormData): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "未登入" };

  const parsed = AddSchema.safeParse({
    technician_id: fd.get("technician_id"),
    month: fd.get("month"),
    type: fd.get("type"),
    amount: fd.get("amount"),
    reason: fd.get("reason"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  // 防呆：該月已 snapshot 鎖定就不能加
  const admin = createAdminClient();
  const { data: snap } = await admin
    .from("payroll_snapshots")
    .select("id")
    .eq("technician_id", parsed.data.technician_id)
    .eq("month", parsed.data.month)
    .maybeSingle();
  if (snap) {
    return {
      ok: false,
      error: "該月已結算鎖定，請先解除鎖定再調整",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("payroll_adjustments").insert({
    technician_id: parsed.data.technician_id,
    month: parsed.data.month,
    type: parsed.data.type,
    amount: parsed.data.amount,
    reason: parsed.data.reason,
    created_by: me.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/payroll/${parsed.data.technician_id}`);
  revalidatePath("/payroll");
  return { ok: true };
}

export async function deletePayrollAdjustment(id: string): Promise<Res> {
  await requireRole(["owner", "manager"]);

  // 找出歸屬 technician + month 後檢查 snapshot
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("payroll_adjustments")
    .select("technician_id, month")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "找不到該紀錄" };

  const { data: snap } = await admin
    .from("payroll_snapshots")
    .select("id")
    .eq("technician_id", row.technician_id)
    .eq("month", row.month)
    .maybeSingle();
  if (snap) {
    return { ok: false, error: "該月已結算鎖定，無法刪除" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_adjustments")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/payroll/${row.technician_id}`);
  revalidatePath("/payroll");
  return { ok: true };
}
