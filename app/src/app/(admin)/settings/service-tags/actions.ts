"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";

const TagSchema = z.object({
  label: z.string().min(1, "請填標籤名稱").max(20),
  sort_order: z.coerce.number().int().default(0),
  active: z.coerce.boolean().default(true),
});

export type Res = { ok: true } | { ok: false; error: string };

export async function createServiceTag(formData: FormData): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const parsed = TagSchema.safeParse({
    label: formData.get("label"),
    sort_order: formData.get("sort_order") ?? 0,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("service_tag_presets").insert(parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/service-tags");
  return { ok: true };
}

export async function updateServiceTag(id: string, formData: FormData): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const parsed = TagSchema.safeParse({
    label: formData.get("label"),
    sort_order: formData.get("sort_order") ?? 0,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_tag_presets")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/service-tags");
  return { ok: true };
}

export async function deleteServiceTag(id: string): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("service_tag_presets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/service-tags");
  return { ok: true };
}
