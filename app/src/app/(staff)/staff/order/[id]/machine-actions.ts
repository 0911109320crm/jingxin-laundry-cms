"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { ALL_MACHINE_TYPES } from "@/lib/validators/customer";

export type Res = { ok: true; machineId?: string } | { ok: false; error: string };

const UpdateSchema = z.object({
  machine_id: z.string().uuid(),
  brand: z.string().max(40).nullable(),
  model: z.string().max(80).nullable(),
  code: z.string().max(40).nullable(),
});

const CreateSchema = z.object({
  order_id: z.string().uuid(),
  order_item_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  type: z.enum(ALL_MACHINE_TYPES),
  brand: z.string().max(40).nullable(),
  model: z.string().max(80).nullable(),
  code: z.string().max(40).nullable(),
  address_id: z.string().uuid().nullable().optional(),
});

/** 師傅更新既有機器的品牌 / 型號 / 編碼 */
export async function updateMachineByStaff(input: {
  machine_id: string;
  brand: string | null;
  model: string | null;
  code: string | null;
}): Promise<Res> {
  await requireRole(["technician", "owner", "manager"]);
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("machines")
    .update({
      brand: parsed.data.brand || null,
      model: parsed.data.model || null,
      code: parsed.data.code || null,
    })
    .eq("id", parsed.data.machine_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/staff/order");
  return { ok: true, machineId: parsed.data.machine_id };
}

/** 師傅建立新機器 + 連結到該 order_item */
export async function createMachineForOrderItem(input: {
  order_id: string;
  order_item_id: string;
  customer_id: string;
  type: (typeof ALL_MACHINE_TYPES)[number];
  brand: string | null;
  model: string | null;
  code: string | null;
  address_id?: string | null;
}): Promise<Res> {
  await requireRole(["technician", "owner", "manager"]);
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: machine, error: mErr } = await supabase
    .from("machines")
    .insert({
      customer_id: parsed.data.customer_id,
      type: parsed.data.type,
      brand: parsed.data.brand || null,
      model: parsed.data.model || null,
      code: parsed.data.code || null,
      address_id: parsed.data.address_id ?? null,
    })
    .select("id")
    .single();
  if (mErr || !machine) {
    return { ok: false, error: mErr?.message ?? "建立機器失敗" };
  }
  const machineId = (machine as { id: string }).id;

  // 連結到該 order_item
  const { error: linkErr } = await supabase
    .from("order_items")
    .update({ machine_id: machineId })
    .eq("id", parsed.data.order_item_id);
  if (linkErr) {
    return { ok: false, error: `機器已建但連結訂單失敗：${linkErr.message}` };
  }

  revalidatePath(`/staff/order/${parsed.data.order_id}`);
  return { ok: true, machineId };
}
