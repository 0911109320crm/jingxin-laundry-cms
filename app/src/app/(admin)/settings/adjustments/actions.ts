"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriteRole } from "@/lib/dal";
import { typeForCategory } from "./categories";

const AdjustmentSchema = z.object({
  name: z.string().min(1, "請填名稱").max(40),
  category: z.enum(["service", "parts", "discount"]),
  default_amount: z.coerce.number().min(0, "金額不可為負"),
  active: z.coerce.boolean().default(true),
  affects_commission: z.coerce.boolean().default(true),
});

export type Res = { ok: true } | { ok: false; error: string };

function toRow(data: {
  name: string;
  category: "service" | "parts" | "discount";
  default_amount: number;
  active: boolean;
  affects_commission: boolean;
}) {
  // category 決定 type（service/parts→addon, discount→discount）
  return { ...data, type: typeForCategory(data.category) };
}

export async function createAdjustment(fd: FormData): Promise<Res> {
  await requireWriteRole(["owner", "manager"]);
  const parsed = AdjustmentSchema.safeParse({
    name: fd.get("name"),
    category: fd.get("category"),
    default_amount: fd.get("default_amount") ?? 0,
    active: fd.get("active") === "on",
    affects_commission: fd.get("affects_commission") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("adjustment_items").insert(toRow(parsed.data));
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/adjustments");
  return { ok: true };
}

export async function updateAdjustment(id: string, fd: FormData): Promise<Res> {
  await requireWriteRole(["owner", "manager"]);
  const parsed = AdjustmentSchema.safeParse({
    name: fd.get("name"),
    category: fd.get("category"),
    default_amount: fd.get("default_amount") ?? 0,
    active: fd.get("active") === "on",
    affects_commission: fd.get("affects_commission") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("adjustment_items")
    .update(toRow(parsed.data))
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/adjustments");
  return { ok: true };
}

export async function deleteAdjustment(id: string): Promise<Res> {
  await requireWriteRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("adjustment_items")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/adjustments");
  return { ok: true };
}
