import Link from "next/link";
import { ChevronLeft, Wallet, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatNTD } from "@/lib/utils";
import { SettleGroup, type PendingOrderLite } from "./SettleButton";

type PendingOrderRow = {
  id: string;
  order_code: string;
  total: number;
  service_at: string | null;
  scheduled_at: string | null;
  note: string | null;
  customer: { name: string; phone: string } | null;
  address: { county: string; district: string } | null;
  items: { technician_id: string | null; created_at: string }[];
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
       items:order_items(technician_id, created_at)`,
    )
    .eq("payment_method", "cash")
    .eq("settlement_status", "pending")
    .order("service_at", { ascending: true, nullsFirst: false });

  const orders = (data as PendingOrderRow[] | null) ?? [];

  // Group by primary technician (earliest item with a technician)
  const grouped = new Map<string, PendingOrderLite[]>();
  for (const o of orders) {
    const sortedItems = [...o.items]
      .filter((it) => it.technician_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const techId = sortedItems[0]?.technician_id ?? UNASSIGNED;
    if (!grouped.has(techId)) grouped.set(techId, []);
    grouped.get(techId)!.push({
      id: o.id,
      order_code: o.order_code,
      total: Number(o.total),
      service_at: o.service_at,
      scheduled_at: o.scheduled_at,
      customer_name: o.customer?.name ?? "—",
      area: o.address
        ? `${o.address.county} ${o.address.district}`
        : null,
    });
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
      total: list.reduce((s, o) => s + o.total, 0),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/payroll"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ChevronLeft className="h-4 w-4" /> 回師傅薪資
        </Link>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">師傅待回繳</h1>
          <p className="text-sm text-zinc-500">
            師傅收了現金、還沒交回給老闆娘的訂單。可逐筆勾選、批次標記、或點查看訂單細節。
          </p>
        </div>
        <Card className="px-5 py-3">
          <p className="text-xs text-zinc-500">全部待回繳總額</p>
          <p className="font-mono text-2xl font-bold text-amber-700">
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                <p className="font-mono text-xl font-bold text-amber-700">
                  {formatNTD(g.total)}
                </p>
              </CardHeader>
              <CardBody className="p-0">
                <SettleGroup
                  technicianName={g.name}
                  orders={g.orders}
                />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
