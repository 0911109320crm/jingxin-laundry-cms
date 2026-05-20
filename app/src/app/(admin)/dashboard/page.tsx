import Link from "next/link";
import {
  TrendingUp,
  ClipboardCheck,
  CalendarClock,
  BellRing,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatNTD } from "@/lib/utils";
import type { OrderInput } from "@/lib/validators/order";
import { SourceAnalysis } from "./SourceAnalysis";

type MonthOrder = {
  id: string;
  status: OrderInput["status"];
  scheduled_at: string | null;
  total: number;
  items: { technician_id: string | null }[];
};

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`,
  };
}

function lastMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  await requireRole(["owner", "manager"]);
  const sp = await searchParams;
  const rangeParam = (["this_month", "last_month", "year", "custom"] as const).includes(
    sp.range as "this_month" | "last_month" | "year" | "custom",
  )
    ? (sp.range as "this_month" | "last_month" | "year" | "custom")
    : "this_month";
  const supabase = await createClient();
  const admin = createAdminClient();
  const { start, end, label } = monthRange();
  const last = lastMonthRange();
  const today = todayRange();

  const [
    { data: monthOrders },
    { data: lastMonthRevenueData },
    { count: dueCount },
    { data: pendingCashOrders },
    { data: techProfiles },
    { count: todayRemainingCount },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, status, scheduled_at, total, items:order_items(technician_id)`,
      )
      .gte("scheduled_at", start)
      .lt("scheduled_at", end),
    supabase
      .from("orders")
      .select("total")
      .eq("status", "done")
      .gte("scheduled_at", last.start)
      .lt("scheduled_at", last.end),
    supabase
      .from("reminders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("orders")
      .select("total")
      .eq("payment_method", "cash")
      .eq("settlement_status", "pending"),
    admin
      .from("user_profiles")
      .select("id, name, role, active")
      .eq("active", true)
      .order("role")
      .order("name"),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_at", today.start)
      .lt("scheduled_at", today.end)
      .in("status", ["pending", "scheduled", "in_progress"]),
  ]);

  // Today's full schedule for the bottom panel
  const { data: todayOrdersRaw } = await supabase
    .from("orders")
    .select(
      `id, order_code, scheduled_at, status, total,
       customer:customers(name),
       address:customer_addresses(district),
       items:order_items(technician_id)`,
    )
    .gte("scheduled_at", today.start)
    .lt("scheduled_at", today.end)
    .neq("status", "cancelled")
    .order("scheduled_at");

  type TodayRow = {
    id: string;
    order_code: string;
    scheduled_at: string;
    status: string;
    total: number;
    customer: { name: string } | null;
    address: { district: string } | null;
    items: { technician_id: string | null }[];
  };
  const todayOrders = (todayOrdersRaw as TodayRow[] | null) ?? [];

  const orders = (monthOrders as MonthOrder[] | null) ?? [];

  let monthRevenue = 0;
  let doneCount = 0;
  let cancelledCount = 0;
  const byTech = new Map<string, { done: number; todo: number }>();

  for (const o of orders) {
    if (o.status === "done") {
      monthRevenue += Number(o.total);
      doneCount++;
    } else if (o.status === "cancelled") {
      cancelledCount++;
    }
    for (const it of o.items) {
      if (!it.technician_id) continue;
      if (!byTech.has(it.technician_id)) {
        byTech.set(it.technician_id, { done: 0, todo: 0 });
      }
      const s = byTech.get(it.technician_id)!;
      if (o.status === "done") s.done++;
      else if (o.status !== "cancelled") s.todo++;
    }
  }
  const cancelRate =
    orders.length > 0
      ? Math.round((cancelledCount / orders.length) * 100)
      : 0;

  const pendingCashTotal =
    ((pendingCashOrders as { total: number }[] | null) ?? []).reduce(
      (s, o) => s + Number(o.total),
      0,
    );

  const lastMonthRevenue =
    ((lastMonthRevenueData as { total: number }[] | null) ?? []).reduce(
      (s, o) => s + Number(o.total),
      0,
    );
  const revenueDiffPct =
    lastMonthRevenue > 0
      ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : null;

  const technicianRows =
    ((techProfiles as { id: string; name: string; role: string; active: boolean }[] | null) ?? [])
      .filter((p) => p.role === "technician")
      .map((p) => {
        const stats = byTech.get(p.id) ?? { done: 0, todo: 0 };
        return { ...p, ...stats, total: stats.done + stats.todo };
      })
      .sort((a, b) => b.total - a.total);

  const maxTotal = Math.max(1, ...technicianRows.map((t) => t.total));

  // Resolve technician names for today's schedule
  const techNameMap = new Map(
    ((techProfiles as { id: string; name: string; role: string; active: boolean }[] | null) ?? [])
      .map((p) => [p.id, p.name] as const),
  );

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">儀表板</h1>
          <p className="text-sm text-zinc-500">{label} 營運概況</p>
        </div>
        {(pendingCashOrders?.length ?? 0) > 0 && (
          <Link
            href="/payroll/settlements"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
          >
            <Wallet className="h-4 w-4" />
            師傅待回繳 {formatNTD(pendingCashTotal)}
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
          label="本月營業額"
          value={formatNTD(monthRevenue)}
          sub={
            revenueDiffPct === null
              ? `${doneCount} 筆已完成`
              : `${doneCount} 筆完成 · 較上月${
                  revenueDiffPct >= 0 ? "↑" : "↓"
                }${Math.abs(revenueDiffPct)}%`
          }
        />
        <KpiCard
          icon={<ClipboardCheck className="h-5 w-5 text-brand-500" />}
          label="本月案件數"
          value={`${orders.length}`}
          sub="本月已排程訂單"
        />
        <Link href={`/calendar`}>
          <KpiCard
            icon={<CalendarClock className="h-5 w-5 text-amber-500" />}
            label="今日待完成"
            value={`${todayRemainingCount ?? 0}`}
            sub="今天還沒完成的案件"
            interactive
          />
        </Link>
        <Link href="/reminders">
          <KpiCard
            icon={<BellRing className="h-5 w-5 text-rose-500" />}
            label="即將到期客戶"
            value={`${dueCount ?? 0}`}
            sub="11-12 個月未服務"
            interactive
          />
        </Link>
        <KpiCard
          icon={
            <span
              className={`flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${
                cancelRate >= 20 ? "bg-rose-500 text-white" : "bg-zinc-300 text-zinc-700"
              }`}
            >
              ×
            </span>
          }
          label="本月取消率"
          value={`${cancelRate}%`}
          sub={`${cancelledCount} / ${orders.length} 取消`}
          alert={cancelRate >= 20}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>師傅本月案量（用於分派新案）</CardTitle>
        </CardHeader>
        <CardBody>
          {technicianRows.length === 0 ? (
            <p className="text-sm text-zinc-500">尚無師傅資料</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm bg-green-500" />
                  已完成
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm bg-amber-400" />
                  待完成
                </span>
              </div>
              {technicianRows.map((t) => {
                const donePct = (t.done / maxTotal) * 100;
                const todoPct = (t.todo / maxTotal) * 100;
                return (
                  <Link
                    key={t.id}
                    href={`/calendar?tech=${t.id}`}
                    className="block rounded-lg p-2 transition-colors hover:bg-zinc-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-sm font-medium text-zinc-900">
                        {t.name}
                      </span>
                      <div className="flex h-7 flex-1 overflow-hidden rounded-md bg-zinc-100">
                        {t.done > 0 && (
                          <div
                            className="flex items-center justify-end bg-green-500 px-2 text-xs font-medium text-white"
                            style={{ width: `${donePct}%` }}
                            title={`已完成 ${t.done}`}
                          >
                            {donePct > 8 ? t.done : ""}
                          </div>
                        )}
                        {t.todo > 0 && (
                          <div
                            className="flex items-center justify-end bg-amber-400 px-2 text-xs font-medium text-white"
                            style={{ width: `${todoPct}%` }}
                            title={`待完成 ${t.todo}`}
                          >
                            {todoPct > 8 ? t.todo : ""}
                          </div>
                        )}
                      </div>
                      <span className="w-28 shrink-0 text-right text-xs text-zinc-500">
                        已 <span className="font-semibold text-green-700">{t.done}</span>
                        {" / "}
                        待 <span className="font-semibold text-amber-700">{t.todo}</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <section id="source-analysis" className="space-y-5 border-t border-zinc-200 pt-6">
        <SourceAnalysis
          range={rangeParam}
          customStart={sp.start}
          customEnd={sp.end}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>今日案件（{todayOrders.length}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {todayOrders.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">今天沒有排定的案件</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {todayOrders.map((o) => {
                const techIds = Array.from(
                  new Set(
                    o.items
                      .map((it) => it.technician_id)
                      .filter(Boolean) as string[],
                  ),
                );
                const techs = techIds
                  .map((tid) => techNameMap.get(tid))
                  .filter(Boolean) as string[];
                const time = new Date(o.scheduled_at).toLocaleTimeString(
                  "zh-TW",
                  { hour: "2-digit", minute: "2-digit", hour12: false },
                );
                return (
                  <li key={o.id}>
                    <Link
                      href={`/orders/${o.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-zinc-50"
                    >
                      <span className="w-14 font-mono text-zinc-900">{time}</span>
                      <span className="w-32 truncate font-medium text-zinc-900">
                        {o.customer?.name ?? "—"}
                      </span>
                      <span className="hidden w-24 truncate text-xs text-zinc-500 md:inline">
                        {o.address?.district ?? ""}
                      </span>
                      <span className="flex-1 text-xs text-zinc-500 truncate">
                        {techs.length > 0 ? `師傅：${techs.join("、")}` : "未指派"}
                      </span>
                      <span className="text-xs font-medium text-zinc-700">
                        {o.status === "done" ? "已完成" : "未完成"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  interactive,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  interactive?: boolean;
  alert?: boolean;
}) {
  return (
    <Card
      className={`${interactive ? "transition-shadow hover:shadow-md " : ""}${
        alert ? "border-rose-300 bg-rose-50" : ""
      }`}
    >
      <CardBody>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          {icon}
          {label}
        </div>
        <p
          className={`mt-2 text-3xl font-bold ${
            alert ? "text-rose-700" : "text-zinc-900"
          }`}
        >
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}
      </CardBody>
    </Card>
  );
}
