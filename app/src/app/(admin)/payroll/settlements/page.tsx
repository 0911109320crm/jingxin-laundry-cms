import Link from "next/link";
import { Wallet, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate, formatNTD } from "@/lib/utils";
import { SettleBatchButton } from "./SettleButton";

type PendingOrder = {
  id: string;
  order_code: string;
  total: number;
  service_at: string | null;
  scheduled_at: string | null;
  note: string | null;
  customer: { name: string; phone: string } | null;
  address: { county: string; district: string } | null;
  items: { technician_id: string | null }[];
};

const UNASSIGNED = "__unassigned__";

export default async function SettlementsPage() {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data } = await supabase
    .from("orders")
    .select(
      `id, order_code, total, service_at, scheduled_at, note,
       customer:customers(name, phone),
       address:customer_addresses(county, district),
       items:order_items(technician_id)`,
    )
    .eq("payment_method", "cash")
    .eq("settlement_status", "pending")
    .order("service_at", { ascending: true, nullsFirst: false });

  const orders = (data as PendingOrder[] | null) ?? [];

  // Group by primary technician (first item's technician)
  const grouped = new Map<string, PendingOrder[]>();
  for (const o of orders) {
    const techId = o.items.find((it) => it.technician_id)?.technician_id ?? UNASSIGNED;
    if (!grouped.has(techId)) grouped.set(techId, []);
    grouped.get(techId)!.push(o);
  }

  // Resolve technician names
  const techIds = Array.from(grouped.keys()).filter((id) => id !== UNASSIGNED);
  let nameMap = new Map<string, string>();
  if (techIds.length > 0) {
    const { data: techs } = await admin
      .from("user_profiles")
      .select("id, name")
      .in("id", techIds);
    nameMap = new Map(
      ((techs ?? []) as { id: string; name: string }[]).map((t) => [
        t.id,
        t.name,
      ]),
    );
  }

  const grandTotal = orders.reduce((s, o) => s + Number(o.total), 0);

  const groups = Array.from(grouped.entries())
    .map(([techId, list]) => ({
      techId,
      name: techId === UNASSIGNED ? "未指派師傅" : nameMap.get(techId) ?? "未知",
      orders: list,
      total: list.reduce((s, o) => s + Number(o.total), 0),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="p-8 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">師傅待回繳</h1>
          <p className="text-sm text-zinc-500">
            列出所有「已收款-現金」但「待回繳」的訂單，按師傅分組
          </p>
        </div>
        <Card className="px-5 py-3">
          <p className="text-xs text-zinc-500">全部待回繳總額</p>
          <p className="text-2xl font-bold text-amber-700 font-mono">
            {formatNTD(grandTotal)}
          </p>
          <p className="text-xs text-zinc-500">{orders.length} 筆訂單</p>
        </Card>
      </header>

      {groups.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-12">
            <Wallet className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              目前沒有待回繳的現金訂單，太棒了！
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.techId}>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-amber-500" />
                  <CardTitle>{g.name}</CardTitle>
                  <span className="text-xs text-zinc-500">
                    {g.orders.length} 筆
                  </span>
                </div>
                <p className="text-xl font-bold text-amber-700 font-mono">
                  {formatNTD(g.total)}
                </p>
              </CardHeader>
              <CardBody className="space-y-1 p-0">
                <ul className="divide-y divide-zinc-200">
                  {g.orders.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/orders/${o.id}`}
                        className="grid grid-cols-[1fr_auto] gap-2 px-5 py-2.5 text-sm transition-colors hover:bg-zinc-50"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-zinc-400">
                              {o.order_code}
                            </span>
                            <span className="font-medium text-zinc-900">
                              {o.customer?.name ?? "—"}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500">
                            {o.address &&
                              `${o.address.county} ${o.address.district} · `}
                            {formatDate(o.service_at ?? o.scheduled_at)}
                          </p>
                        </div>
                        <span className="self-center font-mono text-zinc-900">
                          {formatNTD(o.total)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-zinc-200 px-5 py-3">
                  <SettleBatchButton
                    orderIds={g.orders.map((o) => o.id)}
                    technicianName={g.name}
                    total={g.total}
                  />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
