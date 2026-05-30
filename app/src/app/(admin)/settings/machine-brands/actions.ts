"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";

const BrandSchema = z.object({
  // 與 categories.ts 的 5 個分類一致（之前漏了 washing_twin_tub → 雙槽式分頁新增會失敗）
  category: z.enum([
    "washing_vertical",
    "washing_twin_tub",
    "washing_drum",
    "ac_split",
    "ac_hidden",
  ]),
  name: z.string().min(1, "請填名稱").max(40),
  active: z.coerce.boolean().default(true),
});

export type Res = { ok: true } | { ok: false; error: string };

export async function createBrand(formData: FormData): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const parsed = BrandSchema.safeParse({
    category: formData.get("category"),
    name: formData.get("name"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();

  // sort_order 不再讓老闆娘手動填：自動接在同分類最後（max+10，但排在「(未知)」99990 之前）。
  const { data: maxRow } = await supabase
    .from("machine_brands")
    .select("sort_order")
    .eq("category", parsed.data.category)
    .lt("sort_order", 99990)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 10;

  const { error } = await supabase
    .from("machine_brands")
    .insert({ ...parsed.data, sort_order: nextSort });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/machine-brands");
  return { ok: true };
}

export async function updateBrand(id: string, formData: FormData): Promise<Res> {
  await requireRole(["owner", "manager"]);
  // 只改名稱與啟停；sort_order 不在 UI 上，保留原值不覆寫。
  const parsed = z
    .object({
      name: z.string().min(1, "請填名稱").max(40),
      active: z.coerce.boolean().default(true),
    })
    .safeParse({
      name: formData.get("name"),
      active: formData.get("active") === "on",
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("machine_brands")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/machine-brands");
  return { ok: true };
}

export async function deleteBrand(id: string): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("machine_brands").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/machine-brands");
  return { ok: true };
}
