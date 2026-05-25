"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/dal";
import { CustomerSchema, type CustomerInput } from "@/lib/validators/customer";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** 在訂單表單裡 inline 新增一筆地址，回傳新建的 address_id */
const QuickAddressSchema = z.object({
  customer_id: z.string().uuid(),
  county: z.string().min(1, "請選縣市"),
  district: z.string().min(1, "請選鄉鎮市區"),
  address: z.string().min(1, "請填詳細地址"),
  label: z.string().optional().nullable(),
  is_default: z.boolean().default(false),
});

export async function addCustomerAddressAction(
  input: z.infer<typeof QuickAddressSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireRole(["owner", "manager"]);
  const parsed = QuickAddressSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();

  // 若新地址是 default，先把其他既有的 default 設為 false
  if (parsed.data.is_default) {
    await supabase
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("customer_id", parsed.data.customer_id);
  }

  const { data, error } = await supabase
    .from("customer_addresses")
    .insert({
      customer_id: parsed.data.customer_id,
      county: parsed.data.county,
      district: parsed.data.district,
      address: parsed.data.address,
      label: parsed.data.label || null,
      is_default: parsed.data.is_default,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "新增地址失敗" };
  }

  await logAudit({
    action: "customer.add_address",
    target_type: "customer",
    target_id: parsed.data.customer_id,
    payload: {
      county: parsed.data.county,
      district: parsed.data.district,
      address: parsed.data.address,
    },
  });

  revalidatePath(`/customers/${parsed.data.customer_id}`);
  return { ok: true, id: (data as { id: string }).id };
}

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

  const primaryPhone = data.phones.find((p) => p.is_primary) ?? data.phones[0];

  const { data: customer, error: customerErr } = await supabase
    .from("customers")
    .insert({
      code: data.code,
      name: data.name,
      phone: primaryPhone.phone,
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

  // customer_phones：主電話先插（is_primary=true），副電話後插
  // 順序很重要：trigger 會把 is_primary=true 同步到 customers.phone
  const phonesPayload = data.phones.map((p, idx) => ({
    customer_id: customer.id,
    phone: p.phone.trim(),
    label: p.label?.trim() || null,
    is_primary: p.is_primary,
    sort_order: idx,
  }));
  const { error: phonesErr } = await supabase
    .from("customer_phones")
    .insert(phonesPayload);
  if (phonesErr) return { ok: false, error: `電話寫入失敗：${phonesErr.message}` };

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

  const primaryPhone = data.phones.find((p) => p.is_primary) ?? data.phones[0];

  const { error: updateErr } = await supabase
    .from("customers")
    .update({
      code: data.code,
      name: data.name,
      phone: primaryPhone.phone,
      source_id: data.source_id ?? null,
      referrer_id: data.referrer_id ?? null,
      note: data.note ?? null,
      joined_at: data.joined_at || null,
    })
    .eq("id", id);
  if (updateErr) return { ok: false, error: updateErr.message };

  // customer_phones：replace-all 策略（簡單、可靠）。先全刪、再全插。
  // 注意 trigger trg_sync_primary_phone 會把 is_primary=true 同步到 customers.phone。
  await supabase.from("customer_phones").delete().eq("customer_id", id);
  const phonesPayload = data.phones.map((p, idx) => ({
    customer_id: id,
    phone: p.phone.trim(),
    label: p.label?.trim() || null,
    is_primary: p.is_primary,
    sort_order: idx,
  }));
  const { error: phonesErr } = await supabase
    .from("customer_phones")
    .insert(phonesPayload);
  if (phonesErr) return { ok: false, error: `電話寫入失敗：${phonesErr.message}` };

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

