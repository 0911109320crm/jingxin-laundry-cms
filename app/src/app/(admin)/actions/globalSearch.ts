"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/dal";

export type CustomerResult = {
  id: string;
  code: string;
  name: string;
  phone: string;
  matched_address?: string;
};

export type OrderResult = {
  id: string;
  order_code: string;
  status: string;
  scheduled_at: string | null;
  customer_name: string;
  matched_hint?: string; // 顯示哪個欄位命中（清洗編號／保固單編號）
};

export type SearchResults = {
  customers: CustomerResult[];
  orders: OrderResult[];
};

/**
 * 快速搜尋：只查「電話 + 地址」(都有 trigram 索引 → 快)，供邊打邊即時用。
 * 其餘欄位(姓名/編號/訂單/機器/保固單)交給 globalSearchAction(完整搜尋、按 Enter)。
 */
export async function quickSearchAction(
  query: string,
): Promise<CustomerResult[]> {
  await requireAuth();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supabase = await createClient();
  const like = `%${trimmed}%`;
  const digits = trimmed.replace(/\D/g, "");

  const [{ data: phoneRows }, { data: addrRows }] = await Promise.all([
    digits.length >= 3
      ? supabase
          .from("customer_phones")
          .select("phone, label, customers!inner(id, code, name, phone)")
          .ilike("phone", `%${digits}%`)
          .limit(12)
      : Promise.resolve({ data: null }),
    supabase
      .from("customer_addresses")
      .select(
        "address, county, district, label, customers!inner(id, code, name, phone)",
      )
      .or(`address.ilike.${like},district.ilike.${like}`)
      .limit(12),
  ]);

  const map = new Map<string, CustomerResult>();
  for (const row of (phoneRows ?? []) as unknown as Array<{
    phone: string;
    label: string | null;
    customers: { id: string; code: string; name: string; phone: string } | null;
  }>) {
    const c = row.customers;
    if (!c || map.has(c.id)) continue;
    if (map.size >= 10) break;
    map.set(c.id, {
      id: c.id,
      code: c.code,
      name: c.name,
      phone: c.phone,
      matched_address: `電話 ${row.phone}${row.label ? `（${row.label}）` : ""}`,
    });
  }
  for (const row of (addrRows ?? []) as unknown as Array<{
    address: string;
    county: string;
    district: string;
    label: string | null;
    customers: { id: string; code: string; name: string; phone: string } | null;
  }>) {
    const c = row.customers;
    if (!c) continue;
    if (map.has(c.id)) continue;
    if (map.size >= 10) break;
    map.set(c.id, {
      id: c.id,
      code: c.code,
      name: c.name,
      phone: c.phone,
      matched_address: `${row.county}${row.district} ${row.address}${row.label ? ` (${row.label})` : ""}`,
    });
  }
  return Array.from(map.values());
}

export async function globalSearchAction(query: string): Promise<SearchResults> {
  await requireAuth();

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { customers: [], orders: [] };
  }

  const supabase = await createClient();
  const like = `%${trimmed}%`;
  const digits = trimmed.replace(/\D/g, "");

  // 副電話查詢：只在 query 含 ≥4 位數字時觸發
  const phoneHitsPromise =
    digits.length >= 4
      ? supabase
          .from("customer_phones")
          .select(
            "phone, label, is_primary, customers!inner(id, code, name, phone)",
          )
          .ilike("phone", `%${digits}%`)
          .eq("is_primary", false) // primary 已被下面的 customers 查到
          .limit(10)
      : Promise.resolve({ data: null });

  const [
    { data: customers },
    { data: orders },
    { data: addressMatches },
    { data: phoneHits },
    { data: machineHits },
    { data: itemCodeHits },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, code, name, phone")
      .or(`name.ilike.${like},phone.ilike.${like},code.ilike.${like}`)
      .limit(5),
    // orders 搜尋：order_code / note / 舊清洗編號 legacy_code 都查
    supabase
      .from("orders")
      .select("id, order_code, status, scheduled_at, legacy_code, customers(name)")
      .or(`order_code.ilike.${like},note.ilike.${like},legacy_code.ilike.${like}`)
      .limit(8),
    supabase
      .from("customer_addresses")
      .select(
        "address, county, district, label, customers!inner(id, code, name, phone)",
      )
      .or(`address.ilike.${like},district.ilike.${like}`)
      .limit(10),
    phoneHitsPromise,
    supabase
      .from("machines")
      .select(
        "code, brand, model, customers!inner(id, code, name, phone)",
      )
      .ilike("code", like)
      .not("code", "is", null)
      .limit(10),
    // 保固單編號搜尋：order_items.item_code（如 OLD-20190906-004-1）
    supabase
      .from("order_items")
      .select(
        "item_code, orders!inner(id, order_code, status, scheduled_at, customers(name))",
      )
      .ilike("item_code", like)
      .limit(5),
  ]);

  const customerMap = new Map<string, CustomerResult>();
  for (const c of customers ?? []) {
    customerMap.set(c.id, {
      id: c.id,
      code: c.code,
      name: c.name,
      phone: c.phone,
    });
  }
  for (const row of (addressMatches ?? []) as unknown as Array<{
    address: string;
    county: string;
    district: string;
    label: string | null;
    customers: { id: string; code: string; name: string; phone: string } | null;
  }>) {
    const c = row.customers;
    if (!c) continue;
    const matched = `${row.county}${row.district} ${row.address}${row.label ? ` (${row.label})` : ""}`;
    const existing = customerMap.get(c.id);
    if (existing) {
      if (!existing.matched_address) existing.matched_address = matched;
    } else if (customerMap.size < 8) {
      customerMap.set(c.id, {
        id: c.id,
        code: c.code,
        name: c.name,
        phone: c.phone,
        matched_address: matched,
      });
    }
  }
  // 副電話命中：合進 customerMap，matched_address 改放 "副電話: 09xxx"
  for (const row of (phoneHits ?? []) as unknown as Array<{
    phone: string;
    label: string | null;
    is_primary: boolean;
    customers: { id: string; code: string; name: string; phone: string } | null;
  }>) {
    const c = row.customers;
    if (!c) continue;
    if (customerMap.has(c.id)) continue;
    if (customerMap.size >= 8) break;
    const matched = `副電話 ${row.phone}${row.label ? `（${row.label}）` : ""}`;
    customerMap.set(c.id, {
      id: c.id,
      code: c.code,
      name: c.name,
      phone: c.phone,
      matched_address: matched,
    });
  }
  // 機器編碼命中：合進 customerMap，matched_address 顯示 "機器 #XX (品牌 型號)"
  for (const row of (machineHits ?? []) as unknown as Array<{
    code: string;
    brand: string | null;
    model: string | null;
    customers: { id: string; code: string; name: string; phone: string } | null;
  }>) {
    const c = row.customers;
    if (!c) continue;
    const brandModel = [row.brand, row.model].filter(Boolean).join(" ");
    const matched = `機器 #${row.code}${brandModel ? `（${brandModel}）` : ""}`;
    const existing = customerMap.get(c.id);
    if (existing) {
      if (!existing.matched_address) existing.matched_address = matched;
    } else if (customerMap.size < 8) {
      customerMap.set(c.id, {
        id: c.id,
        code: c.code,
        name: c.name,
        phone: c.phone,
        matched_address: matched,
      });
    }
  }
  const customerResults: CustomerResult[] = Array.from(customerMap.values());

  const orderMap = new Map<string, OrderResult>();
  for (const o of orders ?? []) {
    const cust = o.customers as unknown as { name: string } | null;
    const matchesLegacy = o.legacy_code && o.legacy_code.toLowerCase().includes(trimmed.toLowerCase());
    orderMap.set(o.id, {
      id: o.id,
      order_code: o.order_code,
      status: o.status,
      scheduled_at: o.scheduled_at ?? null,
      customer_name: cust?.name ?? "",
      matched_hint: matchesLegacy ? `舊清洗編號: ${o.legacy_code}` : undefined,
    });
  }
  // 保固單編號命中：把 item_code 結果合進 orderMap
  for (const row of (itemCodeHits ?? []) as unknown as Array<{
    item_code: string;
    orders: {
      id: string;
      order_code: string;
      status: string;
      scheduled_at: string | null;
      customers: { name: string } | null;
    } | null;
  }>) {
    const o = row.orders;
    if (!o) continue;
    if (!orderMap.has(o.id)) {
      orderMap.set(o.id, {
        id: o.id,
        order_code: o.order_code,
        status: o.status,
        scheduled_at: o.scheduled_at,
        customer_name: o.customers?.name ?? "",
        matched_hint: `保固單編號: ${row.item_code}`,
      });
    } else {
      const existing = orderMap.get(o.id)!;
      if (!existing.matched_hint) existing.matched_hint = `保固單編號: ${row.item_code}`;
    }
  }
  const orderResults: OrderResult[] = Array.from(orderMap.values()).slice(0, 8);

  return { customers: customerResults, orders: orderResults };
}
