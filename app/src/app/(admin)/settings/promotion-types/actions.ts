"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriteRole } from "@/lib/dal";

const PromoSchema = z.object({
  code: z
    .string()
    .min(1, "請填代碼")
    .max(64)
    .regex(/^[a-z0-9_]+$/, "代碼僅可用小寫字母 / 數字 / 底線"),
  label: z.string().min(1, "請填顯示文字").max(40),
  points: z.coerce.number().int().min(0).max(99),
  sort_order: z.coerce.number().int().default(0),
  active: z.coerce.boolean().default(true),
});

export type Res = { ok: true } | { ok: false; error: string };

export async function createPromotionType(formData: FormData): Promise<Res> {
  await requireWriteRole(["owner", "manager"]);
  const parsed = PromoSchema.safeParse({
    code: formData.get("code"),
    label: formData.get("label"),
    points: formData.get("points") ?? 1,
    sort_order: formData.get("sort_order") ?? 999,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("promotion_types").insert(parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/promotion-types");
  return { ok: true };
}

export async function updatePromotionType(
  id: string,
  formData: FormData,
): Promise<Res> {
  await requireWriteRole(["owner", "manager"]);
  const parsed = PromoSchema.partial({ code: true }).safeParse({
    label: formData.get("label"),
    points: formData.get("points") ?? 1,
    sort_order: formData.get("sort_order") ?? 0,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("promotion_types")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/promotion-types");
  return { ok: true };
}

export async function deletePromotionType(id: string): Promise<Res> {
  await requireWriteRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("promotion_types").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/promotion-types");
  return { ok: true };
}

const KpiSchema = z.object({
  value: z.coerce.number().int().min(0).max(99),
});

export async function updateKpi(formData: FormData): Promise<Res> {
  await requireWriteRole(["owner"]);
  const parsed = KpiSchema.safeParse({ value: formData.get("value") });
  if (!parsed.success) return { ok: false, error: "KPI 必須是 0-99 之間整數" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("system_settings")
    .upsert(
      {
        key: "monthly_promotion_kpi",
        value: parsed.data.value,
        description: "師傅每月促銷積分 KPI 目標（達標換色顯示）",
      },
      { onConflict: "key" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/promotion-types");
  revalidatePath("/staff");
  revalidatePath("/scores");
  return { ok: true };
}
