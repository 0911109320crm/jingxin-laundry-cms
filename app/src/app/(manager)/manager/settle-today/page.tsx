import Link from "next/link";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardBody } from "@/components/ui/Card";
import { formatNTD, formatTaiwanDate } from "@/lib/utils";
import { resolveCollector, UNASSIGNED } from "@/lib/settlement";
import { SettleAllButton } from "./SettleAllButton";
import { DateNav } from "./DateNav";

type Row = {
  id: string;
  order_code: string;
  total: number;
  service_at: string | null;
  scheduled_at: string | null;
  collected_by_technician_id: string | null;
  customer: { name: string } | null;
  address: { county: string; district: string } | null;
  items: { technician_id: string | null; created_at: string }[];
};

export default async function ManagerSettleTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

  // 日期 = sp.date (YYYY-MM-DD)，預設今天（台灣）
  const targetYmd = sp.date ?? formatTaiwanDate(new Date());
  const fromIso = `${targetYmd}T00:00:00+08:00`;
  const toIso = `${targetYmd}T23:59:59+08:00`;

  // 今日完工的、現金、待回繳訂單
  const { data } = await supabase
    .from("orders")
    .select(
      `id, order_code, total, service_at, scheduled_at, collected_by_technician_id,
       customer:customers(name),
       address:customer_addresses(county, district),
       items:order_items(technician_id, created_at)`,
    )
    .eq("payment_method", "cash")
    .eq("settlement_status", "pending")
    .gte("service_at", fromIso)
    .lte("service_at", toIso)
    .order("service_at");

  const orders = (data as unknown as Row[] | null) ?? [];

  // 按實際收款人分組（舊資料回退用最早建立的有派工 item）
  const grouped = new Map<string, Row[]>();
  for (const o of orders) {
    const techId = resolveCollector(o.collected_by_technician_id, o.items);
    const arr = grouped.get(techId) ?? [];
    arr.push(o);
    grouped.set(techId, arr);
  }

  // 解析師傅名稱
  const techIds = [...grouped.keys()].filter((k) => k !== UNASSIGNED);
  const nameMap = new Map<string, string>();
  if (techIds.length > 0) {
    const { data: techs } = await admin
      .from("user_profiles")
      .select("id, name")
      .in("id", techIds);
    for (const t of ((techs ?? []) as { id: string; name: string }[])) {
      nameMap.set(t.id, t.name);
    }
  }

  const groups = [...grouped.entries()]
    .map(([id, list]) => ({
      techId: id,
      name: id === UNASSIGNED ? "未指派" : nameMap.get(id) ?? "未知",
      orders: list,
      total: list.reduce((s, o) => s + Number(o.total), 0),
    }))
    .sort((a, b) => b.total - a.total);

  const grandTotal = orders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="p-3 space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-base font-bold text-zinc-900">今日回繳</h1>
        <DateNav value={targetYmd} />
      </header>

      <Card>
        <CardBody className="flex items-center justify-between py-2">
          <div>
            <p className="text-[11px] text-zinc-500">{targetYmd} 待回繳總額</p>
            <p className="font-mono text-xl font-bold text-amber-700">
              {formatNTD(grandTotal)}
            </p>
          </div>
          <p className="text-xs text-zinc-500">{orders.length} 筆</p>
        </CardBody>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-10 text-center">
            <Wallet className="h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500">本日沒有現金待回繳，太棒了！</p>
          </CardBody>
        </Card>
      ) : (
        groups.map((g) => (
          <details
            key={g.techId}
            open={g.orders.length <= 3}
            className="rounded-xl border border-zinc-200 bg-white"
          >
            <summary className="flex cursor-pointer items-center justify-between p-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{g.name}</p>
                <p className="text-[11px] text-zinc-500">
                  {g.orders.length} 筆
                </p>
              </div>
              <p className="font-mono text-lg font-bold text-amber-700">
                {formatNTD(g.total)}
              </p>
            </summary>
            <div className="border-t border-zinc-100">
              <ul className="divide-y divide-zinc-100">
                {g.orders.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-start justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-medium text-zinc-900 hover:text-brand-700"
                      >
                        {o.customer?.name ?? "—"}
                      </Link>
                      <p className="font-mono text-[11px] text-zinc-500">
                        {o.order_code}
                        {o.address &&
                          ` · ${o.address.county} ${o.address.district}`}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-bold text-zinc-900">
                      {formatNTD(Number(o.total))}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-zinc-100 p-3">
                <SettleAllButton
                  orderIds={g.orders.map((o) => o.id)}
                  total={g.total}
                  techName={g.name}
                />
              </div>
            </div>
          </details>
        ))
      )}
    </div>
  );
}
