"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";

const BrandSchema = z.object({
  category: z.enum([
    "washing_vertical",
    "washing_drum",
    "ac_split",
    "ac_hidden",
  ]),
  name: z.string().min(1, "請填名稱").max(40),
  sort_order: z.coerce.number().int().default(0),
  active: z.coerce.boolean().default(true),
});

export type Res = { ok: true } | { ok: false; error: string };

export async function createBrand(formData: FormData): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const parsed = BrandSchema.safeParse({
    category: formData.get("category"),
    name: formData.get("name"),
    sort_order: formData.get("sort_order") ?? 999,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("machine_brands").insert(parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/machine-brands");
  return { ok: true };
}

export async function updateBrand(id: string, formData: FormData): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const parsed = BrandSchema.partial({ category: true }).safeParse({
    name: formData.get("name"),
    sort_order: formData.get("sort_order") ?? 0,
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
