"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriteRole } from "@/lib/dal";

// 算台數薪資模型常數（system_settings.key='payroll_v2'，老闆娘可調）
const Schema = z.object({
  base_salary: z.coerce.number().min(0, "本薪不可為負"),
  base_units: z.coerce.number().int().min(0, "基本台數不可為負"),
  overage_unit_rate: z.coerce.number().min(0, "台數獎金不可為負"),
  undismantled_bonus: z.coerce.number().min(0, "未拆解加給不可為負"),
  full_attendance_bonus: z.coerce.number().min(0, "全勤獎金不可為負"),
  meal_base: z.coerce.number().min(0, "伙食底不可為負"),
  meal_per_day: z.coerce.number().min(0, "伙食日額不可為負"),
  marketing_threshold: z.coerce.number().int().min(0, "行銷門檻不可為負"),
  marketing_per_point: z.coerce.number().min(0, "行銷每分獎金不可為負"),
});

export type Res = { ok: true } | { ok: false; error: string };

export async function updatePayrollConstants(fd: FormData): Promise<Res> {
  await requireWriteRole(["owner"]);
  const parsed = Schema.safeParse({
    base_salary: fd.get("base_salary"),
    base_units: fd.get("base_units"),
    overage_unit_rate: fd.get("overage_unit_rate"),
    undismantled_bonus: fd.get("undismantled_bonus"),
    full_attendance_bonus: fd.get("full_attendance_bonus"),
    meal_base: fd.get("meal_base"),
    meal_per_day: fd.get("meal_per_day"),
    marketing_threshold: fd.get("marketing_threshold"),
    marketing_per_point: fd.get("marketing_per_point"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("system_settings").upsert(
    {
      key: "payroll_v2",
      value: parsed.data,
      description: "算台數薪資模型常數（2026-06-10 版）",
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/payroll");
  revalidatePath("/payroll");
  return { ok: true };
}
