import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type PayrollItem = {
  id: string;
  order_id: string;
  order_code: string;
  unit_price: number;
  subtotal: number;
  tag: string | null;
  service_code: string | null;
  service_name: string | null;
  customer_name: string;
  customer_code: string;
  payment_method: string;
  // order-level adjustments allocated against the order (we show on first item of the day)
  order_addons: number;
  order_discount: number;
};

export type DailyRow = {
  day: number;
  date: string; // YYYY-MM-DD
  items: PayrollItem[];
  dayTotal: number;
  addonTotal: number;
  discountTotal: number;
  // count of transferred orders that day (not cash)
  transferredCount: number;
};

export type PayrollData = {
  technician: { id: string; name: string };
  year: number;
  month: number;
  rows: DailyRow[];
  monthTotal: number;
  monthAddon: number;
  monthDiscount: number;
  totalItems: number;
};

export async function fetchPayroll(
  technicianId: string,
  monthStr: string, // "YYYY-MM"
): Promise<PayrollData | null> {
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m) return null;

  const admin = createAdminClient();
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 1);

  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, name")
    .eq("id", technicianId)
    .single();
  const tech = profile as { id: string; name: string } | null;
  if (!tech) return null;

  // Fetch order_items of this technician in the month
  const { data: itemsRaw } = await admin
    .from("order_items")
    .select(
      `id, order_id, unit_price, subtotal, tag,
       service:service_items(code, name),
       order:orders(order_code, status, service_at, scheduled_at, payment_method,
                    customer:customers(name, code),
                    adjustments:order_adjustments(type, amount))`,
    )
    .eq("technician_id", technicianId)
    .gte("orders.scheduled_at", monthStart.toISOString())
    .lt("orders.scheduled_at", monthEnd.toISOString());

  type Raw = {
    id: string;
    order_id: string;
    unit_price: number;
    subtotal: number;
    tag: string | null;
    service: { code: string; name: string } | null;
    order: {
      order_code: string;
      status: string;
      service_at: string | null;
      scheduled_at: string | null;
      payment_method: string;
      customer: { name: string; code: string } | null;
      adjustments: { type: string; amount: number }[];
    } | null;
  };

  const items = (itemsRaw as Raw[] | null) ?? [];

  // Build day rows
  const byDay = new Map<number, DailyRow>();
  for (let d = 1; d <= 31; d++) {
    // skip out-of-month days at month end
    const check = new Date(y, m - 1, d);
    if (check.getMonth() !== m - 1) continue;
    byDay.set(d, {
      day: d,
      date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      items: [],
      dayTotal: 0,
      addonTotal: 0,
      discountTotal: 0,
      transferredCount: 0,
    });
  }

  const seenOrderForAdjPerDay = new Map<string, Set<string>>(); // "YYYY-MM-DD" -> orderIds counted for adj
  const seenOrderForPayment = new Map<string, Set<string>>();

  for (const it of items) {
    if (!it.order) continue;
    if (it.order.status === "cancelled") continue;
    const dateStr = (it.order.service_at ?? it.order.scheduled_at)?.slice(0, 10);
    if (!dateStr) continue;
    const day = Number(dateStr.slice(8, 10));
    const row = byDay.get(day);
    if (!row) continue;

    const addons = it.order.adjustments
      .filter((a) => a.type === "addon")
      .reduce((s, a) => s + Number(a.amount), 0);
    const discount = it.order.adjustments
      .filter((a) => a.type === "discount")
      .reduce((s, a) => s + Number(a.amount), 0);

    // Count adjustments only once per order per day
    if (!seenOrderForAdjPerDay.has(dateStr))
      seenOrderForAdjPerDay.set(dateStr, new Set());
    const seen = seenOrderForAdjPerDay.get(dateStr)!;
    let orderAddon = 0;
    let orderDiscount = 0;
    if (!seen.has(it.order_id)) {
      seen.add(it.order_id);
      orderAddon = addons;
      orderDiscount = discount;
      row.addonTotal += addons;
      row.discountTotal += discount;
    }

    // Count transfer once per order per day
    if (!seenOrderForPayment.has(dateStr))
      seenOrderForPayment.set(dateStr, new Set());
    const seenPay = seenOrderForPayment.get(dateStr)!;
    if (!seenPay.has(it.order_id)) {
      seenPay.add(it.order_id);
      if (
        it.order.payment_method === "transfer" ||
        it.order.payment_method === "card" ||
        it.order.payment_method === "line_pay"
      ) {
        row.transferredCount += 1;
      }
    }

    row.items.push({
      id: it.id,
      order_id: it.order_id,
      order_code: it.order.order_code,
      unit_price: Number(it.unit_price),
      subtotal: Number(it.subtotal),
      tag: it.tag,
      service_code: it.service?.code ?? null,
      service_name: it.service?.name ?? null,
      customer_name: it.order.customer?.name ?? "—",
      customer_code: it.order.customer?.code ?? "",
      payment_method: it.order.payment_method,
      order_addons: orderAddon,
      order_discount: orderDiscount,
    });
    row.dayTotal += Number(it.subtotal);
  }

  // Add net total per day
  let monthTotal = 0;
  let monthAddon = 0;
  let monthDiscount = 0;
  let totalItems = 0;
  for (const row of byDay.values()) {
    const dayNet = row.dayTotal + row.addonTotal - row.discountTotal;
    monthTotal += dayNet;
    monthAddon += row.addonTotal;
    monthDiscount += row.discountTotal;
    totalItems += row.items.length;
  }

  return {
    technician: tech,
    year: y,
    month: m,
    rows: Array.from(byDay.values()).sort((a, b) => a.day - b.day),
    monthTotal,
    monthAddon,
    monthDiscount,
    totalItems,
  };
}
