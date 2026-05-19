"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/dal";

export type CustomerResult = {
  id: string;
  code: string;
  name: string;
  phone: string;
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

  const [{ data: customers }, { data: orders }] = await Promise.all([
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
  ]);

  const customerResults: CustomerResult[] = (customers ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    phone: c.phone,
  }));

  const orderResults: OrderResult[] = (orders ?? []).map((o) => {
    const cust = o.customers as { name: string } | null;
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
