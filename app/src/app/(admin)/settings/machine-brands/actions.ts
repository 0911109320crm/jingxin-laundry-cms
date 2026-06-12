"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriteRole } from "@/lib/dal";

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
  await requireWriteRole(["owner", "manager"]);
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
  await requireWriteRole(["owner", "manager"]);
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

/**
 * 直接把某品牌移到第 N 順位（老闆娘輸入 1、2、3…）。
 * 把該分類所有品牌(排除「(未知)」)依目前順序取出，移動該筆到 newPos，
 * 再重新編號 sort_order=10,20,30…；「(未知)」維持 99990 墊底。
 */
export async function reorderBrand(id: string, newPos: number): Promise<Res> {
  await requireWriteRole(["owner", "manager"]);
  if (!Number.isFinite(newPos)) return { ok: false, error: "順序須為數字" };
  const supabase = await createClient();

  const { data: cur } = await supabase
    .from("machine_brands")
    .select("id, category")
    .eq("id", id)
    .single();
  const c = cur as { id: string; category: string } | null;
  if (!c) return { ok: false, error: "找不到品牌" };

  const { data: rows } = await supabase
    .from("machine_brands")
    .select("id")
    .eq("category", c.category)
    .neq("name", "(未知)")
    .order("sort_order");
  const ids = ((rows as { id: string }[] | null) ?? []).map((r) => r.id);

  const from = ids.indexOf(id);
  if (from === -1) return { ok: false, error: "找不到品牌" };
  // 目標索引（0-based），夾在 0 ~ 最後
  const to = Math.min(Math.max(Math.round(newPos) - 1, 0), ids.length - 1);
  if (to === from) return { ok: true };

  ids.splice(from, 1);
  ids.splice(to, 0, id);

  // 重新編號（只更新順序真的有變的，省寫入）
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from("machine_brands")
      .update({ sort_order: (i + 1) * 10 })
      .eq("id", ids[i]);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/settings/machine-brands");
  return { ok: true };
}

export async function deleteBrand(id: string): Promise<Res> {
  await requireWriteRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("machine_brands").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/machine-brands");
  return { ok: true };
}
