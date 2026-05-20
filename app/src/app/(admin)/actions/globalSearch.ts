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
};

export type SearchResults = {
  customers: CustomerResult[];
  orders: OrderResult[];
};

export async function globalSearchAction(query: string): Promise<SearchResults> {
  await requireAuth();

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { customers: [], orders: [] };
  }

  const supabase = await createClient();
  const like = `%${trimmed}%`;

  const [
    { data: customers },
    { data: orders },
    { data: addressMatches },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, code, name, phone")
      .or(`name.ilike.${like},phone.ilike.${like},code.ilike.${like}`)
      .limit(5),
    supabase
      .from("orders")
      .select("id, order_code, status, scheduled_at, customers(name)")
      .or(`order_code.ilike.${like},note.ilike.${like}`)
      .limit(5),
    supabase
      .from("customer_addresses")
      .select(
        "address, county, district, label, customers!inner(id, code, name, phone)",
      )
      .or(`address.ilike.${like},district.ilike.${like}`)
      .limit(10),
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
  const customerResults: CustomerResult[] = Array.from(customerMap.values());

  const orderResults: OrderResult[] = (orders ?? []).map((o) => {
    const cust = o.customers as unknown as { name: string } | null;
    return {
      id: o.id,
      order_code: o.order_code,
      status: o.status,
      scheduled_at: o.scheduled_at ?? null,
      customer_name: cust?.name ?? "",
    };
  });

  return { customers: customerResults, orders: orderResults };
}
