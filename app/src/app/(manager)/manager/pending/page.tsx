import Link from "next/link";
import { MapPin, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardBody } from "@/components/ui/Card";
import { formatNTD, formatDateTime } from "@/lib/utils";
import { AssignTechForm } from "./AssignTechForm";

type PendingOrder = {
  id: string;
  order_code: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  estimated_total: number | null;
  total: number | null;
  note: string | null;
  customer: { name: string; phone: string } | null;
  address: {
    county: string;
    district: string;
    address: string;
  } | null;
  items: {
    id: string;
    quantity: number;
    technician_id: string | null;
    service: { name: string; category: string | null } | null;
  }[];
};

type Tech = { id: string; name: string };

export default async function ManagerPendingPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: ordersData }, { data: techsData }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, order_code, scheduled_at, duration_minutes, estimated_total, total, note,
         customer:customers(name, phone),
         address:customer_addresses(county, district, address),
         items:order_items(id, quantity, technician_id,
                           service:service_items(name, category))`,
      )
      // 待派案 = pending；或 scheduled 但所有 items 都沒指派
      .in("status", ["pending", "scheduled"])
      .order("scheduled_at", { ascending: true, nullsFirst: true }),
    admin
      .from("user_profiles")
      .select("id, name")
      .eq("active", true)
      .eq("role", "technician")
      .order("name"),
  ]);

  const allOrders = (ordersData as unknown as PendingOrder[] | null) ?? [];
  const technicians = (techsData as Tech[] | null) ?? [];

  // 過濾出真正「未指派」的：所有 items.technician_id 都是 null
  const pending = allOrders.filter(
    (o) => o.items.every((it) => !it.technician_id),
  );

  // 按 county + district 排序方便看順路
  pending.sort((a, b) => {
    const ka = `${a.address?.county ?? ""}|${a.address?.district ?? ""}`;
    const kb = `${b.address?.county ?? ""}|${b.address?.district ?? ""}`;
    return ka.localeCompare(kb, "zh-TW");
  });

  // 同鄉鎮分組
  const groups = new Map<string, PendingOrder[]>();
  for (const o of pending) {
    const key = `${o.address?.county ?? "未填"}-${o.address?.district ?? "未填"}`;
    const arr = groups.get(key) ?? [];
    arr.push(o);
    groups.set(key, arr);
  }

  return (
    <div className="p-3 space-y-3">
      <header>
        <h1 className="text-base font-bold text-zinc-900">待派案</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          共 {pending.length} 案 · 按地址鄉鎮分組（點開可指派師傅）
        </p>
      </header>

      {pending.length === 0 && (
        <Card>
          <CardBody className="py-8 text-center text-sm text-zinc-500">
            目前沒有待派案件
          </CardBody>
        </Card>
      )}

      {[...groups.entries()].map(([groupKey, orders]) => {
        const totalMins = orders.reduce(
          (s, o) => s + (o.duration_minutes ?? 90),
          0,
        );
        return (
          <section key={groupKey} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-zinc-700">
                {groupKey}
              </h2>
              <span className="text-xs text-zinc-500">
                {orders.length} 案 · 共 {totalMins} 分
              </span>
            </div>
            {orders.map((o) => (
              <PendingCard
                key={o.id}
                order={o}
                technicians={technicians}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function PendingCard({
  order,
  technicians,
}: {
  order: PendingOrder;
  technicians: Tech[];
}) {
  const items = order.items;
  const itemSummary = items
    .map(
      (it) =>
        `${it.service?.name ?? "—"}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`,
    )
    .join("、");
  const addr = order.address
    ? `${order.address.county}${order.address.district}${order.address.address}`
    : "—";

  return (
    <Card>
      <CardBody className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-zinc-900">
              {order.customer?.name ?? "—"}
            </p>
            <p className="font-mono text-[11px] text-zinc-500">
              {order.order_code}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-zinc-500">暫估</p>
            <p className="font-mono text-sm font-bold text-brand-700">
              {formatNTD(order.estimated_total ?? order.total)}
            </p>
          </div>
        </div>

        <p className="flex items-start gap-1.5 text-sm text-zinc-700">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}
            target="_blank"
            rel="noopener"
            className="text-brand-700 underline"
          >
            {addr}
          </a>
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {order.scheduled_at ? formatDateTime(order.scheduled_at) : "未排時段"}
          </span>
          <span>預計 {order.duration_minutes ?? 90} 分</span>
        </div>

        {itemSummary && (
          <p className="text-xs text-zinc-600">
            <span className="text-zinc-400">品項：</span>
            {itemSummary}
          </p>
        )}

        {order.note && (
          <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
            備註：{order.note}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2">
          <Link
            href={`/orders/${order.id}`}
            className="text-xs text-brand-700 hover:underline"
          >
            開啟詳細 →
          </Link>
          <AssignTechForm orderId={order.id} technicians={technicians} />
        </div>
      </CardBody>
    </Card>
  );
}
