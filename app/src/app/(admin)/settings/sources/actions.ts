"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriteRole } from "@/lib/dal";

const SourceSchema = z.object({
  name: z.string().min(1, "請填名稱").max(40),
  sort_order: z.coerce.number().int().default(0),
  active: z.coerce.boolean().default(true),
});

export type Res = { ok: true } | { ok: false; error: string };

export async function createSource(formData: FormData): Promise<Res> {
  await requireWriteRole(["owner", "manager"]);
  const parsed = SourceSchema.safeParse({
    name: formData.get("name"),
    sort_order: formData.get("sort_order") ?? 0,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_sources").insert(parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/sources");
  return { ok: true };
}

export async function updateSource(id: string, formData: FormData): Promise<Res> {
  await requireWriteRole(["owner", "manager"]);
  const parsed = SourceSchema.safeParse({
    name: formData.get("name"),
    sort_order: formData.get("sort_order") ?? 0,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_sources")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/sources");
  return { ok: true };
}

export async function deleteSource(id: string): Promise<Res> {
  await requireWriteRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("customer_sources").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/sources");
  return { ok: true };
}
