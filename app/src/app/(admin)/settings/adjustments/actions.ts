"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";

const AdjustmentSchema = z.object({
  name: z.string().min(1, "請填名稱").max(40),
  type: z.enum(["discount", "addon"]),
  default_amount: z.coerce.number().min(0, "金額不可為負"),
  active: z.coerce.boolean().default(true),
});

export type Res = { ok: true } | { ok: false; error: string };

export async function createAdjustment(fd: FormData): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const parsed = AdjustmentSchema.safeParse({
    name: fd.get("name"),
    type: fd.get("type"),
    default_amount: fd.get("default_amount") ?? 0,
    active: fd.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("adjustment_items").insert(parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/adjustments");
  return { ok: true };
}

export async function updateAdjustment(id: string, fd: FormData): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const parsed = AdjustmentSchema.safeParse({
    name: fd.get("name"),
    type: fd.get("type"),
    default_amount: fd.get("default_amount") ?? 0,
    active: fd.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("adjustment_items")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/adjustments");
  return { ok: true };
}

export async function deleteAdjustment(id: string): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("adjustment_items")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/adjustments");
  return { ok: true };
}
