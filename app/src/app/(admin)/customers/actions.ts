"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/dal";
import { CustomerSchema, type CustomerInput } from "@/lib/validators/customer";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type CustomerPickerResult = {
  id: string;
  code: string;
  name: string;
  phone: string;
};

/** Search customers for inline picker (referrer field). Excludes a given id. */
export async function searchCustomersForPickerAction(
  query: string,
  excludeId?: string,
): Promise<CustomerPickerResult[]> {
  await requireAuth();
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const supabase = await createClient();
  const like = `%${trimmed}%`;
  let q = supabase
    .from("customers")
    .select("id, code, name, phone")
    .or(`name.ilike.${like},phone.ilike.${like},code.ilike.${like}`)
    .limit(10);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return (data as CustomerPickerResult[] | null) ?? [];
}

/** Resolve a single customer by id (for picker initial display). */
export async function getCustomerByIdAction(
  id: string,
): Promise<CustomerPickerResult | null> {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, code, name, phone")
    .eq("id", id)
    .single();
  return (data as CustomerPickerResult | null) ?? null;
}

export async function createCustomerAction(
  input: CustomerInput,
): Promise<ActionResult> {
  await requireRole(["owner", "manager"]);
  const parsed = CustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "資料錯誤" };
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { data: customer, error: customerErr } = await supabase
    .from("customers")
    .insert({
      code: data.code,
      name: data.name,
      phone: data.phone,
      source_id: data.source_id ?? null,
      referrer_id: data.referrer_id ?? null,
      note: data.note ?? null,
      joined_at: data.joined_at || null,
    })
    .select("id")
    .single<{ id: string }>();

  if (customerErr || !customer) {
    return {
      ok: false,
      error: customerErr?.message ?? "建立顧客失敗",
    };
  }

  if (data.addresses.length > 0) {
    const { error } = await supabase.from("customer_addresses").insert(
      data.addresses.map((a, idx) => ({
        customer_id: customer.id,
        county: a.county,
        district: a.district,
        address: a.address,
        label: a.label ?? null,
        is_default: a.is_default || idx === 0,
      })),
    );
    if (error) return { ok: false, error: `地址寫入失敗：${error.message}` };
  }

  if (data.machines.length > 0) {
    const { error } = await supabase.from("machines").insert(
      data.machines.map((m) => ({
        customer_id: customer.id,
        type: m.type,
        brand: m.brand ?? null,
        model: m.model ?? null,
        sub_type: m.sub_type ?? null,
        note: m.note ?? null,
        address_id: m.address_id ?? null,
      })),
    );
    if (error) return { ok: false, error: `機器寫入失敗：${error.message}` };
  }

  revalidatePath("/customers");
  return { ok: true };
}

export async function updateCustomerAction(
  id: string,
  input: CustomerInput,
): Promise<ActionResult> {
  await requireRole(["owner", "manager"]);
  const parsed = CustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "資料錯誤" };
  }
  const data = parsed.data;
  const supabase = await createClient();

  // 自介紹防呆
  if (data.referrer_id && data.referrer_id === id) {
    return { ok: false, error: "介紹人不能是自己" };
  }

  const { error: updateErr } = await supabase
    .from("customers")
    .update({
      code: data.code,
      name: data.name,
      phone: data.phone,
      source_id: data.source_id ?? null,
      referrer_id: data.referrer_id ?? null,
      note: data.note ?? null,
      joined_at: data.joined_at || null,
    })
    .eq("id", id);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Replace-all strategy for addresses and machines (simple v1 — preserves ids when present)
  // Delete addresses not in payload, upsert the rest
  const keepAddressIds = data.addresses.map((a) => a.id).filter(Boolean);
  if (keepAddressIds.length > 0) {
    await supabase
      .from("customer_addresses")
      .delete()
      .eq("customer_id", id)
      .not("id", "in", `(${keepAddressIds.join(",")})`);
  } else {
    await supabase.from("customer_addresses").delete().eq("customer_id", id);
  }

  for (const [idx, a] of data.addresses.entries()) {
    if (a.id) {
      await supabase
        .from("customer_addresses")
        .update({
          county: a.county,
          district: a.district,
          address: a.address,
          label: a.label ?? null,
          is_default: a.is_default || idx === 0,
        })
        .eq("id", a.id);
    } else {
      await supabase.from("customer_addresses").insert({
        customer_id: id,
        county: a.county,
        district: a.district,
        address: a.address,
        label: a.label ?? null,
        is_default: a.is_default || idx === 0,
      });
    }
  }

  // machines: same replace-all
  const keepMachineIds = data.machines.map((m) => m.id).filter(Boolean);
  if (keepMachineIds.length > 0) {
    await supabase
      .from("machines")
      .delete()
      .eq("customer_id", id)
      .not("id", "in", `(${keepMachineIds.join(",")})`);
  } else {
    await supabase.from("machines").delete().eq("customer_id", id);
  }

  for (const m of data.machines) {
    if (m.id) {
      await supabase
        .from("machines")
        .update({
          type: m.type,
          brand: m.brand ?? null,
          model: m.model ?? null,
          sub_type: m.sub_type ?? null,
          note: m.note ?? null,
          address_id: m.address_id ?? null,
        })
        .eq("id", m.id);
    } else {
      await supabase.from("machines").insert({
        customer_id: id,
        type: m.type,
        brand: m.brand ?? null,
        model: m.model ?? null,
        sub_type: m.sub_type ?? null,
        note: m.note ?? null,
        address_id: m.address_id ?? null,
      });
    }
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ action: "customer.delete", target_type: "customer", target_id: id });
  revalidatePath("/customers");
  redirect("/customers");
}

export type DuplicateAddressResult = {
  id: string;
  code: string;
  name: string;
  phone: string;
} | null;

export async function checkDuplicateAddressAction(
  county: string,
  district: string,
  address: string,
  excludeCustomerId?: string,
): Promise<DuplicateAddressResult> {
  await requireRole(["owner", "manager"]);
  const trimmed = address.trim();
  if (!trimmed || trimmed.length < 3) return null;

  const supabase = await createClient();
  let query = supabase
    .from("customer_addresses")
    .select("customer_id, customers(id, code, name, phone)")
    .eq("county", county)
    .eq("district", district)
    .ilike("address", trimmed)
    .limit(1);

  if (excludeCustomerId) {
    query = query.neq("customer_id", excludeCustomerId);
  }

  const { data } = await query;
  const row = data?.[0];
  if (!row) return null;

  const c = row.customers as unknown as { id: string; code: string; name: string; phone: string } | null;
  if (!c) return null;
  return { id: c.id, code: c.code, name: c.name, phone: c.phone };
}

