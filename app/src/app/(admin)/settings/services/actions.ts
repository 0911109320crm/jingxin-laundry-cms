"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";

const ServiceSchema = z.object({
  code: z
    .string()
    .min(1, "請填代碼")
    .max(20)
    .regex(/^[A-Za-z0-9_\-]+$/, "代碼只能用英數、_、-"),
  name: z.string().min(1, "請填名稱").max(40),
  default_price: z.coerce.number().min(0, "金額不可為負"),
  category: z.string().optional().nullable(),
  sort_order: z.coerce.number().int().default(0),
  active: z.coerce.boolean().default(true),
  is_basic_choice: z.coerce.boolean().default(false),
  commission_type: z.enum(["default", "percent", "amount"]).default("default"),
  commission_value: z.coerce.number().min(0, "抽成數值不可為負").default(0),
});

export type Res = { ok: true } | { ok: false; error: string };

export async function createService(fd: FormData): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const parsed = ServiceSchema.safeParse({
    code: fd.get("code"),
    name: fd.get("name"),
    default_price: fd.get("default_price") ?? 0,
    category: fd.get("category") || null,
    sort_order: fd.get("sort_order") ?? 0,
    active: fd.get("active") === "on",
    is_basic_choice: fd.get("is_basic_choice") === "on",
    commission_type: fd.get("commission_type") ?? "default",
    commission_value: fd.get("commission_value") ?? 0,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("service_items").insert(parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/services");
  return { ok: true };
}

export async function updateService(id: string, fd: FormData): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const parsed = ServiceSchema.safeParse({
    code: fd.get("code"),
    name: fd.get("name"),
    default_price: fd.get("default_price") ?? 0,
    category: fd.get("category") || null,
    sort_order: fd.get("sort_order") ?? 0,
    active: fd.get("active") === "on",
    is_basic_choice: fd.get("is_basic_choice") === "on",
    commission_type: fd.get("commission_type") ?? "default",
    commission_value: fd.get("commission_value") ?? 0,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_items")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/services");
  return { ok: true };
}

export async function deleteService(id: string): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("service_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/services");
  return { ok: true };
}
