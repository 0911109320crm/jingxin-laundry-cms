import Link from "next/link";
import { CalendarDays, MapPin, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import {
  PaymentBadge,
  StatusBadge,
  SettlementBadge,
} from "@/components/orders/StatusBadges";
import { formatNTD } from "@/lib/utils";
import type { OrderInput } from "@/lib/validators/order";

type SP = Promise<{ date?: string }>;

type StaffOrder = {
  id: string;
  order_code: string;
  scheduled_at: string;
  status: OrderInput["status"];
  payment_method: OrderInput["payment_method"];
  settlement_status: "pending" | "settled" | "not_required";
  total: number;
  customer: { name: string; phone: string } | null;
  address: { county: string; district: string; address: string } | null;
  items: { quantity: number; service: { name: string } | null }[];
};

function dateRange(dateStr?: string) {
  const target = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  if (Number.isNaN(target.getTime())) {
    return dateRange();
  }
  const start = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString(), label: start };
}

export default async function StaffHome({ searchParams }: { searchParams: SP }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const sp = await searchParams;
  const { startIso, endIso, label } = dateRange(sp.date);

  const supabase = await createClient();
  // RLS scopes to orders where this user has any order_item
  const [{ data }, { data: pendingCashRows }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, order_code, scheduled_at, status, payment_method, settlement_status, total,
         customer:customers(name, phone),
         address:customer_addresses(county, district, address),
         items:order_items(quantity, service:service_items(name))`,
      )
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso)
      .order("scheduled_at"),
    supabase
      .from("orders")
      .select("total")
      .eq("payment_method", "cash")
      .eq("settlement_status", "pending"),
  ]);

  const orders = (data as StaffOrder[] | null) ?? [];
  const pendingCashTotal =
    ((pendingCashRows as { total: number }[] | null) ?? []).reduce(
      (s, o) => s + Number(o.total),
      0,
    );
  const pendingCashCount = (pendingCashRows as unknown[] | null)?.length ?? 0;
  const dateLabel = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(label);

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentStr = sp.date ?? todayStr;
  const prev = new Date(`${currentStr}T00:00:00`);
  prev.setDate(prev.getDate() - 1);
  const next = new Date(`${currentStr}T00:00:00`);
  next.setDate(next.getDate() + 1);
  const prevStr = prev.toISOString().slice(0, 10);
  const nextStr = next.toISOString().slice(0, 10);

  return (
    <div className="p-4 space-y-4">
      {pendingCashCount > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-700">您手上待回繳現金</p>
              <p className="text-xs text-amber-600">{pendingCashCount} 筆訂單</p>
            </div>
            <p className="text-2xl font-bold text-amber-800 font-mono">
              NT$ {pendingCashTotal.toLocaleString()}
            </p>
          </CardBody>
        </Card>
      )}
      <header className="flex items-center justify-between">
        <Link
          href={`/staff?date=${prevStr}`}
          className="rounded-lg bg-white px-3 py-1.5 text-sm shadow-sm"
        >
          ◀ 前一天
        </Link>
        <div className="text-center">
          <p className="text-base font-semibold text-zinc-900">{dateLabel}</p>
          {sp.date && sp.date !== todayStr && (
            <Link
              href="/staff"
              className="text-xs text-brand-600 hover:underline"
            >
              回今天
            </Link>
          )}
        </div>
        <Link
          href={`/staff?date=${nextStr}`}
          className="rounded-lg bg-white px-3 py-1.5 text-sm shadow-sm"
        >
          後一天 ▶
        </Link>
      </header>

      {orders.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-12">
            <CalendarDays className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">今天沒有案件</p>
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const t = new Date(o.scheduled_at);
            const time = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
            return (
              <li key={o.id}>
                <Link href={`/staff/order/${o.id}`}>
                  <Card className="transition-shadow active:shadow-md">
                    <CardBody className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-zinc-900">
                            {time}
                          </span>
                          <span className="font-mono text-xs text-zinc-400">
                            {o.order_code}
                          </span>
                        </div>
                        <ChevronRight className="h-5 w-5 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-zinc-900">
                          {o.customer?.name ?? "—"}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {o.customer?.phone}
                        </p>
                      </div>
                      {o.items.length > 0 && (
                        <p className="text-sm text-zinc-700">
                          {o.items
                            .map((it) =>
                              it.service?.name
                                ? `${it.service.name}${it.quantity > 1 ? `×${it.quantity}` : ""}`
                                : null,
                            )
                            .filter(Boolean)
                            .join("、")}
                        </p>
                      )}
                      {o.address && (
                        <p className="flex items-start gap-1 text-sm text-zinc-600">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                          <span>
                            {o.address.county} {o.address.district}{" "}
                            {o.address.address}
                          </span>
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge value={o.status} />
                          <PaymentBadge value={o.payment_method} />
                          {o.settlement_status !== "not_required" && (
                            <SettlementBadge value={o.settlement_status} />
                          )}
                        </div>
                        <span className="font-mono text-base font-semibold text-zinc-900">
                          {formatNTD(o.total)}
                        </span>
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
