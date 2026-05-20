import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatNTD } from "@/lib/utils";
import { SourcePie, SourceRepurchaseBar } from "./SourceCharts";

type Range = "this_month" | "last_month" | "year" | "custom";

function resolveRange(
  range: Range,
  start?: string,
  end?: string,
): { startIso: string; endIso: string; label: string } {
  const now = new Date();
  if (range === "this_month") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      startIso: s.toISOString(),
      endIso: e.toISOString(),
      label: `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`,
    };
  }
  if (range === "last_month") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startIso: s.toISOString(),
      endIso: e.toISOString(),
      label: `${s.getFullYear()} 年 ${s.getMonth() + 1} 月`,
    };
  }
  if (range === "year") {
    const s = new Date(now.getFullYear(), 0, 1);
    const e = new Date(now.getFullYear() + 1, 0, 1);
    return {
      startIso: s.toISOString(),
      endIso: e.toISOString(),
      label: `${now.getFullYear()} 年度`,
    };
  }
  // custom
  const s = start ? new Date(`${start}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const e = end ? new Date(`${end}T23:59:59`) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    startIso: s.toISOString(),
    endIso: e.toISOString(),
    label: `${s.toLocaleDateString("zh-TW")} ~ ${e.toLocaleDateString("zh-TW")}`,
  };
}

type OrderRow = {
  id: string;
  total: number;
  customer_id: string;
  customer: { source_id: string | null } | null;
};

export async function SourceAnalysis({
  range,
  customStart,
  customEnd,
}: {
  range: Range;
  customStart?: string;
  customEnd?: string;
}) {
  const supabase = await createClient();
  const { startIso, endIso, label } = resolveRange(range, customStart, customEnd);

  // 取期間內已完成訂單 + 客戶 source_id
  const { data: ordersData } = await supabase
    .from("orders")
    .select("id, total, customer_id, customer:customers(source_id)")
    .eq("status", "done")
    .gte("service_at", startIso)
    .lt("service_at", endIso);
  const orders = (ordersData as OrderRow[] | null) ?? [];

  // 來源主檔（含已停用，因為歷史資料可能用到舊來源）
  const { data: sourcesData } = await supabase
    .from("customer_sources")
    .select("id, name");
  const sourceMap = new Map(
    ((sourcesData as { id: string; name: string }[] | null) ?? []).map((s) => [s.id, s.name]),
  );

  // 期間內每位客戶 lifetime 訂單數（用於計算「老顧客回流」）
  const customerIds = Array.from(new Set(orders.map((o) => o.customer_id)));
  const lifetimeMap = new Map<string, number>();
  if (customerIds.length > 0) {
    const { data: lifetime } = await supabase
      .from("orders")
      .select("customer_id")
      .eq("status", "done")
      .in("customer_id", customerIds);
    for (const r of (lifetime as { customer_id: string }[] | null) ?? []) {
      lifetimeMap.set(r.customer_id, (lifetimeMap.get(r.customer_id) ?? 0) + 1);
    }
  }

  // 來源彙整
  type Agg = {
    name: string;
    count: number;
    revenue: number;
    customers: Set<string>;
    returningCustomers: number;
  };
  const bySource = new Map<string, Agg>();
  let totalReturning = 0;
  let totalUnique = 0;
  const seenCustomers = new Set<string>();

  for (const o of orders) {
    const srcKey = o.customer?.source_id ?? "__null__";
    const srcName =
      o.customer?.source_id ? sourceMap.get(o.customer.source_id) ?? "（未知來源）" : "（未填）";
    if (!bySource.has(srcKey)) {
      bySource.set(srcKey, {
        name: srcName,
        count: 0,
        revenue: 0,
        customers: new Set(),
        returningCustomers: 0,
      });
    }
    const agg = bySource.get(srcKey)!;
    agg.count += 1;
    agg.revenue += Number(o.total);
    if (!agg.customers.has(o.customer_id)) {
      agg.customers.add(o.customer_id);
      if ((lifetimeMap.get(o.customer_id) ?? 0) >= 2) agg.returningCustomers += 1;
    }
    if (!seenCustomers.has(o.customer_id)) {
      seenCustomers.add(o.customer_id);
      totalUnique += 1;
      if ((lifetimeMap.get(o.customer_id) ?? 0) >= 2) totalReturning += 1;
    }
  }

  const chartData = Array.from(bySource.values())
    .map((a) => ({
      name: a.name,
      count: a.count,
      revenue: a.revenue,
      repurchaseRate:
        a.customers.size > 0
          ? Math.round((a.returningCustomers / a.customers.size) * 100)
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const returningRate = totalUnique > 0 ? Math.round((totalReturning / totalUnique) * 100) : 0;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">來源分析</h2>
          <p className="text-sm text-zinc-500">{label}</p>
        </div>
        <RangeTabs current={range} customStart={customStart} customEnd={customEnd} />
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiSmall label="期間案件數" value={`${totalOrders}`} />
        <KpiSmall label="期間營業額" value={formatNTD(totalRevenue)} />
        <KpiSmall label="不重複客戶數" value={`${totalUnique}`} />
        <KpiSmall label="老顧客回流比例" value={`${returningRate}%`} hint={`${totalReturning} / ${totalUnique}`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>來源比例（按案件數）</CardTitle>
          </CardHeader>
          <CardBody>
            <SourcePie data={chartData} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>各來源回購率</CardTitle>
          </CardHeader>
          <CardBody>
            <SourceRepurchaseBar data={chartData} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>來源明細</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {chartData.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">本期間無資料</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr className="text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2 text-left">來源</th>
                  <th className="px-5 py-2 text-right">案件數</th>
                  <th className="px-5 py-2 text-right">營業額</th>
                  <th className="px-5 py-2 text-right">案件占比</th>
                  <th className="px-5 py-2 text-right">回購率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {chartData.map((r) => (
                  <tr key={r.name}>
                    <td className="px-5 py-2.5 font-medium text-zinc-900">{r.name}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{r.count}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{formatNTD(r.revenue)}</td>
                    <td className="px-5 py-2.5 text-right text-zinc-500">
                      {totalOrders > 0 ? Math.round((r.count / totalOrders) * 100) : 0}%
                    </td>
                    <td className="px-5 py-2.5 text-right text-zinc-500">{r.repurchaseRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function KpiSmall({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-zinc-900 font-mono">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
      </CardBody>
    </Card>
  );
}

function RangeTabs({
  current,
  customStart,
  customEnd,
}: {
  current: Range;
  customStart?: string;
  customEnd?: string;
}) {
  const tabs: { key: Range; label: string }[] = [
    { key: "this_month", label: "本月" },
    { key: "last_month", label: "上月" },
    { key: "year", label: "年度" },
    { key: "custom", label: "自訂" },
  ];
  const baseUrl = "/dashboard";

  const buildUrl = (r: Range) => {
    const p = new URLSearchParams();
    p.set("range", r);
    if (r === "custom") {
      if (customStart) p.set("start", customStart);
      if (customEnd) p.set("end", customEnd);
    }
    return `${baseUrl}?${p.toString()}#source-analysis`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={buildUrl(t.key)}
            className={
              t.key === current
                ? "rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm"
                : "rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900"
            }
          >
            {t.label}
          </a>
        ))}
      </div>
      {current === "custom" && (
        <form action={baseUrl} method="get" className="flex items-center gap-2">
          <input type="hidden" name="range" value="custom" />
          <input
            type="date"
            name="start"
            defaultValue={customStart ?? ""}
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
          />
          <span className="text-xs text-zinc-400">~</span>
          <input
            type="date"
            name="end"
            defaultValue={customEnd ?? ""}
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white"
          >
            套用
          </button>
        </form>
      )}
    </div>
  );
}
