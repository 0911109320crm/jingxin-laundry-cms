"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWriteRole, getCurrentUser } from "@/lib/dal";
import { fetchPayroll } from "@/lib/payroll";

const MonthSchema = z.string().regex(/^\d{4}-\d{2}$/, "月份格式錯誤");

export type Res = { ok: true } | { ok: false; error: string };

/**
 * 結算單一師傅當月：把當下計算結果寫入 payroll_snapshots
 * 之後 fetchPayroll 會優先讀 snapshot，改設定不再影響此月。
 */
export async function finalizeTechMonth(
  technicianId: string,
  monthStr: string,
): Promise<Res> {
  await requireWriteRole(["owner", "manager"]);
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "未登入" };

  const monthParse = MonthSchema.safeParse(monthStr);
  if (!monthParse.success)
    return { ok: false, error: monthParse.error.issues[0].message };

  const data = await fetchPayroll(technicianId, monthStr);
  if (!data) return { ok: false, error: "找不到該師傅" };
  if (data.finalized) return { ok: false, error: "該月已結算" };

  // breakdown JSONB：完整凍結當下計算結果（除身分/年月/finalized 外全部存入，
  // fetchPayroll 讀回時直接 spread 還原）。
  const {
    technician: _t,
    year: _y,
    month: _mo,
    finalized: _f,
    ...breakdown
  } = data;
  void _t;
  void _y;
  void _mo;
  void _f;

  const supabase = await createClient();
  const { error } = await supabase.from("payroll_snapshots").insert({
    technician_id: technicianId,
    month: monthStr,
    net_amount: data.monthTotal,
    breakdown,
    finalized_by: me.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/payroll/${technicianId}`);
  revalidatePath("/payroll");
  return { ok: true };
}

/** 解除結算（owner only） */
export async function unfinalizeTechMonth(
  technicianId: string,
  monthStr: string,
): Promise<Res> {
  await requireWriteRole(["owner"]);

  const monthParse = MonthSchema.safeParse(monthStr);
  if (!monthParse.success)
    return { ok: false, error: monthParse.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_snapshots")
    .delete()
    .eq("technician_id", technicianId)
    .eq("month", monthStr);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/payroll/${technicianId}`);
  revalidatePath("/payroll");
  return { ok: true };
}

/** 一鍵結算整月（所有啟用中師傅尚未結算的） */
export async function finalizeAllTechsForMonth(
  monthStr: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requireWriteRole(["owner"]);

  const monthParse = MonthSchema.safeParse(monthStr);
  if (!monthParse.success)
    return { ok: false, error: monthParse.error.issues[0].message };

  const admin = createAdminClient();
  const { data: techs } = await admin
    .from("user_profiles")
    .select("id")
    .eq("role", "technician")
    .eq("active", true);

  if (!techs?.length) return { ok: true, count: 0 };

  let count = 0;
  for (const t of techs as { id: string }[]) {
    const res = await finalizeTechMonth(t.id, monthStr);
    if (res.ok) count += 1;
  }

  revalidatePath("/payroll");
  return { ok: true, count };
}
