import Link from "next/link";
import { Download, TrendingUp, ClipboardCheck, Users, Receipt, Fuel, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate, formatNTD } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/validators/order";

type Range = "today" | "week" | "month" | "quarter" | "year" | "custom";

type SP = Promise<{ range?: Range; from?: string; to?: string }>;

type RawOrder = {
  id: string;
  status: string;
  total: number;
  service_at: string | null;
  scheduled_at: string | null;
  payment_method: string;
  customer_id: string;
  customer: { name: string; code: string } | null;
  address: { county: string; district: string } | null;
  items: {
    technician_id: string | null;
    service_item_id: string;
    subtotal: number;
    service: { code: string; name: string } | null;
  }[];
};

function dateRange(range: Range, from?: string, to?: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = new Date(startOfToday);
  let end = new Date(startOfToday);
  end.setDate(end.getDate() + 1);
  switch (range) {
    case "today":
      break;
    case "week": {
      const day = now.getDay();
      const mondayOffset = (day + 6) % 7;
      start.setDate(start.getDate() - mondayOffset);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      break;
    }
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      end = new Date(now.getFullYear(), q * 3 + 3, 1);
      break;
    }
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      break;
    case "custom":
      if (from) start = new Date(from);
      if (to) {
        end = new Date(to);
        end.setDate(end.getDate() + 1);
      }
      break;
  }
  return { start, end };
}

function rangeLabel(range: Range, start: Date, end: Date) {
  const fmt = (d: Date) => formatDate(d);
  switch (range) {
    case "today":
      return `今日（${fmt(start)}）`;
    case "week":
      return `本週（${fmt(start)} — ${fmt(new Date(end.getTime() - 86400000))}）`;
    case "month":
      return `本月（${start.getFullYear()}/${start.getMonth() + 1}）`;
    case "quarter":
      return `本季（Q${Math.floor(start.getMonth() / 3) + 1}）`;
    case "year":
      return `今年（${start.getFullYear()}）`;
    case "custom":
      return `自訂（${fmt(start)} — ${fmt(new Date(end.getTime() - 86400000))}）`;
  }
}

const RANGE_TABS: { key: Range; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "week", label: "本週" },
  { key: "month", label: "本月" },
  { key: "quarter", label: "本季" },
  { key: "year", label: "今年" },
];

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  await requireRole(["owner", "manager"]);
  const sp = await searchParams;
  const range = (sp.range ?? "month") as Range;
  const { start, end } = dateRange(range, sp.from, sp.to);
  const label = rangeLabel(range, start, end);

  const supabase = await createClient();
  const admin = createAdminClient();

  // 用 scheduled_at 篩選（完成的訂單 service_at 可能與 scheduled_at 不同日，先以排程日為準）
  const { data: ordersRaw } = await supabase
    .from("orders")
    .select(
      `id, status, total, service_at, scheduled_at, payment_method, customer_id,
       customer:customers(name, code),
       address:customer_addresses(county, district),
       items:order_items(technician_id, service_item_id, subtotal,
                         service:service_items(code, name))`,
    )
    .gte("scheduled_at", start.toISOString())
    .lt("scheduled_at", end.toISOString());

  const orders = (ordersRaw as RawOrder[] | null) ?? [];

  // 期間師傅代墊支出（成本）：依 expense_date 歸期
  const pad = (n: number) => String(n).padStart(2, "0");
  const dkey = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const { data: expRaw } = await supabase
    .from("technician_expenses")
    .select("name, amount, expense_date")
    .gte("expense_date", dkey(start))
    .lt("expense_date", dkey(end));
  const expenses =
    (expRaw as { name: string; amount: number; expense_date: string }[] | null) ??
    [];
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const expByName = new Map<string, { name: string; count: number; amount: number }>();
  for (const e of expenses) {
    const key = e.name.trim() || "（未命名）";
    if (!expByName.has(key)) expByName.set(key, { name: key, count: 0, amount: 0 });
    const r = expByName.get(key)!;
    r.count += 1;
    r.amount += Number(e.amount);
  }
  const expenseRows = Array.from(expByName.values()).sort(
    (a, b) => b.amount - a.amount,
  );

  // === Aggregations ===
  const doneOrders = orders.filter((o) => o.status === "done");
  const totalRevenue = doneOrders.reduce((s, o) => s + Number(o.total), 0);
  const netRevenue = totalRevenue - expenseTotal;
  const uniqueCustomers = new Set(doneOrders.map((o) => o.customer_id)).size;
  const avgTicket = doneOrders.length > 0
    ? Math.round(totalRevenue / doneOrders.length)
    : 0;

  // Service TOP
  const serviceMap = new Map<string, { code: string; name: string; count: number; revenue: number }>();
  for (const o of doneOrders) {
    for (const it of o.items) {
      if (!it.service) continue;
      const key = it.service.code;
      if (!serviceMap.has(key)) {
        serviceMap.set(key, {
          code: it.service.code,
          name: it.service.name,
          count: 0,
          revenue: 0,
        });
      }
      const s = serviceMap.get(key)!;
      s.count += 1;
      s.revenue += Number(it.subtotal);
    }
  }
  const serviceTop = Array.from(serviceMap.values()).sort((a, b) => b.count - a.count);
  const maxServiceCount = Math.max(1, ...serviceTop.map((s) => s.count));

  // Region heatmap
  const regionMap = new Map<string, number>();
  for (const o of doneOrders) {
    if (!o.address) continue;
    const key = `${o.address.county} ${o.address.district}`;
    regionMap.set(key, (regionMap.get(key) ?? 0) + 1);
  }
  const regions = Array.from(regionMap.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const maxRegionCount = Math.max(1, ...regions.map((r) => r.count));

  // Payment method distribution
  const paymentMap = new Map<string, { count: number; revenue: number }>();
  for (const o of doneOrders) {
    const k = o.payment_method;
    if (!paymentMap.has(k)) paymentMap.set(k, { count: 0, revenue: 0 });
    const p = paymentMap.get(k)!;
    p.count += 1;
    p.revenue += Number(o.total);
  }
  const payments = Array.from(paymentMap.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.count - a.count);

  // Technician revenue
  const techMap = new Map<string, { count: number; revenue: number }>();
  for (const o of doneOrders) {
    for (const it of o.items) {
      if (!it.technician_id) continue;
      if (!techMap.has(it.technician_id))
        techMap.set(it.technician_id, { count: 0, revenue: 0 });
      const t = techMap.get(it.technician_id)!;
      t.count += 1;
      t.revenue += Number(it.subtotal);
    }
  }
  const techIds = Array.from(techMap.keys());
  let techNameMap = new Map<string, string>();
  if (techIds.length > 0) {
    const { data: techs } = await admin
      .from("user_profiles")
      .select("id, name")
      .in("id", techIds);
    techNameMap = new Map(
      ((techs ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]),
    );
  }
  const techRows = Array.from(techMap.entries())
    .map(([id, v]) => ({
      id,
      name: techNameMap.get(id) ?? "未知",
      ...v,
    }))
    .sort((a, b) => b.revenue - a.revenue);
  const maxTechRevenue = Math.max(1, ...techRows.map((t) => t.revenue));

  // TOP Customers
  const customerMap = new Map<
    string,
    { id: string; name: string; code: string; count: number; revenue: number }
  >();
  for (const o of doneOrders) {
    if (!customerMap.has(o.customer_id)) {
      customerMap.set(o.customer_id, {
        id: o.customer_id,
        name: o.customer?.name ?? "未知",
        code: o.customer?.code ?? "",
        count: 0,
        revenue: 0,
      });
    }
    const c = customerMap.get(o.customer_id)!;
    c.count += 1;
    c.revenue += Number(o.total);
  }
  const topCustomers = Array.from(customerMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  const maxCustomerRevenue = Math.max(1, ...topCustomers.map((c) => c.revenue));

  // CSV download URL
  const csvParams = new URLSearchParams({ range });
  if (sp.from) csvParams.set("from", sp.from);
  if (sp.to) csvParams.set("to", sp.to);

  return (
    <div className="p-6 space-y-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">營業報表</h1>
          <p className="text-sm text-zinc-500">{label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1">
            {RANGE_TABS.map((t) => (
              <Link
                key={t.key}
                href={`/reports?range=${t.key}`}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  range === t.key
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:bg-white/60"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <form
            method="get"
            action="/reports"
            className="flex items-center gap-1"
          >
            <input type="hidden" name="range" value="custom" />
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ""}
              className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm"
            />
            <span className="text-zinc-400">—</span>
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ""}
              className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm"
            />
            <Button type="submit" size="sm" variant="outline">
              查詢
            </Button>
          </form>
          <a href={`/api/reports/export?${csvParams.toString()}`} target="_blank">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" /> 匯出 CSV
            </Button>
          </a>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
          label="期間營業額" value={formatNTD(totalRevenue)} />
        <Kpi icon={<Fuel className="h-5 w-5 text-rose-500" />}
          label="期間支出（師傅代墊）" value={`- ${formatNTD(expenseTotal)}`} />
        <Kpi icon={<Wallet className="h-5 w-5 text-indigo-500" />}
          label="淨營收（營業額−支出）" value={formatNTD(netRevenue)} />
        <Kpi icon={<ClipboardCheck className="h-5 w-5 text-brand-500" />}
          label="完成案件數" value={`${doneOrders.length}`}
          sub={`期間總訂單 ${orders.length}`} />
        <Kpi icon={<Users className="h-5 w-5 text-purple-500" />}
          label="服務客戶數" value={`${uniqueCustomers}`} />
        <Kpi icon={<Receipt className="h-5 w-5 text-amber-500" />}
          label="平均客單價" value={formatNTD(avgTicket)} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>服務項目 TOP</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {serviceTop.length === 0 ? (
              <p className="text-sm text-zinc-500">期間內無已完成案件</p>
            ) : (
              serviceTop.map((s) => (
                <div key={s.code} className="flex items-center gap-3">
                  <code className="w-8 shrink-0 rounded bg-zinc-100 px-1 text-center text-xs">
                    {s.code}
                  </code>
                  <span className="w-32 shrink-0 truncate text-sm">{s.name}</span>
                  <div className="flex h-5 flex-1 overflow-hidden rounded bg-zinc-100">
                    <div
                      className="bg-brand-500"
                      style={{ width: `${(s.count / maxServiceCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs text-zinc-600">
                    {s.count} 件 · {formatNTD(s.revenue)}
                  </span>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>區域熱區（前 10）</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {regions.length === 0 ? (
              <p className="text-sm text-zinc-500">期間內無已完成案件</p>
            ) : (
              regions.map((r) => (
                <div key={r.key} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm">{r.key}</span>
                  <div className="flex h-5 flex-1 overflow-hidden rounded bg-zinc-100">
                    <div
                      className="bg-orange-500"
                      style={{ width: `${(r.count / maxRegionCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs text-zinc-600">
                    {r.count}
                  </span>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>付款方式分佈</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {payments.length === 0 ? (
              <p className="text-sm text-zinc-500">期間內無已完成案件</p>
            ) : (
              payments.map((p) => {
                const pct = doneOrders.length > 0
                  ? Math.round((p.count / doneOrders.length) * 100)
                  : 0;
                return (
                  <div key={p.key} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-sm">
                      {PAYMENT_METHOD_LABEL[p.key as keyof typeof PAYMENT_METHOD_LABEL] ?? p.key}
                    </span>
                    <div className="flex h-5 flex-1 overflow-hidden rounded bg-zinc-100">
                      <div
                        className="bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-zinc-600">
                      {pct}% · {formatNTD(p.revenue)}
                    </span>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>師傅營業額</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {techRows.length === 0 ? (
              <p className="text-sm text-zinc-500">期間內無指派師傅的已完成案件</p>
            ) : (
              techRows.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-sm font-medium">{t.name}</span>
                  <div className="flex h-5 flex-1 overflow-hidden rounded bg-zinc-100">
                    <div
                      className="bg-indigo-500"
                      style={{ width: `${(t.revenue / maxTechRevenue) * 100}%` }}
                    />
                  </div>
                  <span className="w-32 shrink-0 text-right text-xs text-zinc-600">
                    {t.count} 件 · {formatNTD(t.revenue)}
                  </span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-4 w-4 text-rose-500" /> 師傅代墊支出明細（期間成本）
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {expenseRows.length === 0 ? (
            <p className="text-sm text-zinc-500">期間內無代墊支出</p>
          ) : (
            <>
              {expenseRows.map((e) => (
                <div
                  key={e.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-zinc-700">
                    {e.name}
                    <span className="ml-1 text-xs text-zinc-400">
                      × {e.count}
                    </span>
                  </span>
                  <span className="font-mono text-rose-600">
                    - {formatNTD(e.amount)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-sm font-medium text-zinc-900">
                <span>支出合計</span>
                <span className="font-mono text-rose-600">
                  - {formatNTD(expenseTotal)}
                </span>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>VIP 客戶 TOP 10（期間消費排行）</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {topCustomers.length === 0 ? (
            <p className="text-sm text-zinc-500">期間內無已完成案件</p>
          ) : (
            topCustomers.map((c, idx) => (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-zinc-50"
              >
                <span className="w-6 shrink-0 text-center text-sm font-bold text-zinc-400">
                  {idx + 1}
                </span>
                <span className="w-28 shrink-0 truncate text-sm font-medium text-zinc-900">
                  {c.name}
                </span>
                <span className="hidden w-20 shrink-0 truncate text-xs text-zinc-400 sm:inline">
                  {c.code}
                </span>
                <div className="flex h-5 flex-1 overflow-hidden rounded bg-zinc-100">
                  <div
                    className="bg-rose-500"
                    style={{ width: `${(c.revenue / maxCustomerRevenue) * 100}%` }}
                  />
                </div>
                <span className="w-32 shrink-0 text-right text-xs text-zinc-600">
                  {c.count} 次 · {formatNTD(c.revenue)}
                </span>
              </Link>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Kpi({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          {icon}{label}
        </div>
        <p className="mt-2 text-3xl font-bold text-zinc-900">{value}</p>
        {sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}
      </CardBody>
    </Card>
  );
}
