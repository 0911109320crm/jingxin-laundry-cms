"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/dal";
import { CustomerSchema, type CustomerInput } from "@/lib/validators/customer";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * 合併重複地址：把 mergeIds 的訂單/機器改指到 keepId，再把 mergeIds 軟刪除(可復原)。
 * 歷史訂單不掉(只是改指到保留地址)；被併地址標記 merged_into_id、不真刪。
 */
export async function mergeAddressesAction(
  customerId: string,
  keepId: string,
  mergeIds: string[],
): Promise<{ ok: true; movedOrders: number } | { ok: false; error: string }> {
  const me = await requireRole(["owner", "manager"]);
  const ids = Array.from(new Set(mergeIds.filter((x) => x && x !== keepId)));
  if (!keepId || ids.length === 0) {
    return { ok: false, error: "請選擇要保留的地址與至少一筆要併入的地址" };
  }
  const supabase = await createClient();

  // 驗證：保留地址 + 併入地址都屬於此客戶、且尚未被合併
  const { data: valid } = await supabase
    .from("customer_addresses")
    .select("id")
    .eq("customer_id", customerId)
    .is("merged_into_id", null)
    .in("id", [keepId, ...ids]);
  const validIds = new Set(((valid as { id: string }[] | null) ?? []).map((r) => r.id));
  if (!validIds.has(keepId) || !ids.every((i) => validIds.has(i))) {
    return { ok: false, error: "地址資料已變動，請重新整理後再試" };
  }

  // 先算會搬動幾筆訂單(供回報/稽核)
  const { count: movedOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("address_id", ids);

  // 1) 訂單改指到保留地址
  const { error: oErr } = await supabase
    .from("orders")
    .update({ address_id: keepId })
    .in("address_id", ids);
  if (oErr) return { ok: false, error: `訂單改指失敗：${oErr.message}` };

  // 2) 機器改指到保留地址
  const { error: mErr } = await supabase
    .from("machines")
    .update({ address_id: keepId })
    .in("address_id", ids);
  if (mErr) return { ok: false, error: `機器改指失敗：${mErr.message}` };

  // 3) 軟刪除被併地址(可復原)
  const { error: aErr } = await supabase
    .from("customer_addresses")
    .update({
      merged_into_id: keepId,
      merged_at: new Date().toISOString(),
      merged_by: me.id,
    })
    .in("id", ids);
  if (aErr) return { ok: false, error: `合併失敗：${aErr.message}` };

  await logAudit({
    action: "customer.merge_addresses",
    target_type: "customer",
    target_id: customerId,
    payload: { keep_id: keepId, merged_ids: ids, moved_orders: movedOrders ?? 0 },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/customers/${customerId}/edit`);
  return { ok: true, movedOrders: movedOrders ?? 0 };
}

/**
 * 產生下一個顧客編號（C00001、C00002...）。
 *
 * 規則：
 *   - 只看 C 開頭 + 5 碼數字（C00001 ~ C99999）的既有編號
 *   - 取最大流水 + 1，補零到 5 碼
 *   - 不會跟 OLD-XXXXX 衝突（不同 prefix）
 *
 * 老闆娘建單時可改成任意自訂編號（譬如 VIP-001、STAFF-002），
 * 此 action 只在建立新客戶時提供「下一個建議編號」。
 */
export async function nextCustomerCodeAction(): Promise<string> {
  await requireAuth();
  const supabase = await createClient();
  // 撈所有 C 開頭的編號，client 端解析最大流水
  const { data } = await supabase
    .from("customers")
    .select("code")
    .like("code", "C_____") // C + 5 碼（PostgreSQL `_` 是單字元）
    .order("code", { ascending: false })
    .limit(1);
  const rows = (data as { code: string }[] | null) ?? [];
  let maxSeq = 0;
  for (const r of rows) {
    const m = r.code.match(/^C(\d{5})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }
  const next = (maxSeq + 1).toString().padStart(5, "0");
  return `C${next}`;
}

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

/**
 * 建單表單用：只更新某客戶的「來源」(customers.source_id)。
 * 老顧客當初沒填來源，老闆娘建單時可順手補，不必切到編輯顧客頁。
 * 刻意只動 source_id 一欄，避免覆蓋其他客戶資料。
 */
export async function updateCustomerSourceAction(
  customerId: string,
  sourceId: string | null,
): Promise<ActionResult> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ source_id: sourceId })
    .eq("id", customerId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
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

  // 先檢查是否還有訂單引用此客戶——外鍵會擋下，但原始 SQL 錯誤對使用者是天書，
  // 改成看得懂的提示。
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", id);
  if (count && count > 0) {
    return {
      ok: false,
      error: `此客戶名下還有 ${count} 筆訂單，無法刪除客戶。如要刪除，請先逐筆刪除該客戶的訂單；若只是想刪掉某一筆訂單，請到「訂單」頁面刪除，不要刪客戶。`,
    };
  }

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

