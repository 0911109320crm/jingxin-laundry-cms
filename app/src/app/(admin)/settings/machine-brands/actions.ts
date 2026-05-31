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

/**
 * 上移 / 下移品牌顯示順序（與相鄰品牌交換 sort_order）。
 * 老闆娘用 ↑↓ 調順序、不用看數字；「(未知)」(99990)排除在外永遠墊底。
 */
export async function moveBrand(
  id: string,
  direction: "up" | "down",
): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();

  const { data: cur } = await supabase
    .from("machine_brands")
    .select("id, category, sort_order")
    .eq("id", id)
    .single();
  const c = cur as { id: string; category: string; sort_order: number } | null;
  if (!c) return { ok: false, error: "找不到品牌" };

  let q = supabase
    .from("machine_brands")
    .select("id, sort_order")
    .eq("category", c.category)
    .neq("name", "(未知)")
    .limit(1);
  q =
    direction === "up"
      ? q.lt("sort_order", c.sort_order).order("sort_order", { ascending: false })
      : q.gt("sort_order", c.sort_order).order("sort_order", { ascending: true });
  const { data: adjRows } = await q;
  const adj = (adjRows as { id: string; sort_order: number }[] | null)?.[0];
  if (!adj) return { ok: true }; // 已在頂/底，不動作

  // 交換兩者的 sort_order（sort_order 無唯一約束，可安全交換）
  const e1 = await supabase
    .from("machine_brands")
    .update({ sort_order: adj.sort_order })
    .eq("id", c.id);
  const e2 = await supabase
    .from("machine_brands")
    .update({ sort_order: c.sort_order })
    .eq("id", adj.id);
  if (e1.error || e2.error)
    return { ok: false, error: (e1.error ?? e2.error)!.message };

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
