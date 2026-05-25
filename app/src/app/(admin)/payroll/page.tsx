import Link from "next/link";
import {
  ChevronRight,
  Wallet,
  Trophy,
  Users,
  TrendingUp,
  CheckCircle2,
  Coins,
  Download,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatNTD } from "@/lib/utils";
import { fetchPayroll } from "@/lib/payroll";
import { FinalizeAllButton } from "./FinalizeAllButton";

type SP = Promise<{ month?: string }>;

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

function daysLeftInMonth(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const today = new Date();
  if (today.getFullYear() !== y || today.getMonth() !== m - 1) {
    return null; // not current month
  }
  return Math.max(0, lastDay - today.getDate());
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const me = await requireRole(["owner", "manager"]);
  const isOwner = me.profile.role === "owner";
  const sp = await searchParams;
  const month = sp.month ?? currentMonthValue();
  const { start, end } = monthRange(month);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const remaining = daysLeftInMonth(month);

  const supabase = await createClient();
  const admin = createAdminClient();

  const [
    { data: technicians },
    { data: pendingOrdersRaw },
    { data: monthPromos },
    { data: kpiRow },
  ] = await Promise.all([
    admin
      .from("user_profiles")
      .select("id, name")
      .eq("role", "technician")
      .eq("active", true)
      .order("name"),
    supabase
      .from("orders")
      .select(
        "id, total, items:order_items(technician_id, created_at)",
      )
      .eq("payment_method", "cash")
      .eq("settlement_status", "pending"),
    admin
      .from("order_promotions")
      .select("credited_to, points_snapshot")
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    admin
      .from("system_settings")
      .select("value")
      .eq("key", "monthly_promotion_kpi")
      .maybeSingle(),
  ]);

  const techs = (technicians as { id: string; name: string }[] | null) ?? [];
  const kpi = typeof kpiRow?.value === "number" ? kpiRow.value : 30;

  // Pending settlements grouped by primary technician
  type PendingOrderRow = {
    id: string;
    total: number;
    items: { technician_id: string | null; created_at: string }[];
  };
  const pendingOrders = (pendingOrdersRaw as PendingOrderRow[] | null) ?? [];
  const pendingByTech = new Map<string, { count: number; total: number }>();
  let totalPending = 0;
  let totalPendingCount = 0;
  for (const o of pendingOrders) {
    totalPending += Number(o.total);
    totalPendingCount += 1;
    // primary = earliest created item with a technician
    const sortedItems = [...o.items]
      .filter((it) => it.technician_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const techId = sortedItems[0]?.technician_id;
    if (!techId) continue;
    const prev = pendingByTech.get(techId) ?? { count: 0, total: 0 };
    prev.count += 1;
    prev.total += Number(o.total);
    pendingByTech.set(techId, prev);
  }

  // Points by technician for the month
  const pointsByTech = new Map<string, number>();
  for (const p of (monthPromos as
    | { credited_to: string | null; points_snapshot: number }[]
    | null) ?? []) {
    if (!p.credited_to) continue;
    pointsByTech.set(
      p.credited_to,
      (pointsByTech.get(p.credited_to) ?? 0) + Number(p.points_snapshot),
    );
  }

  // Fetch each technician's payroll summary in parallel
  const payrolls = await Promise.all(
    techs.map((t) => fetchPayroll(t.id, month)),
  );

  type TechRow = {
    id: string;
    name: string;
    salary: number;
    addon: number;
    discount: number;
    items: number;
    points: number;
    achieved: boolean;
    pendingCount: number;
    pendingTotal: number;
    finalized: boolean;
  };

  const rows: TechRow[] = techs.map((t, i) => {
    const p = payrolls[i];
    const points = pointsByTech.get(t.id) ?? 0;
    const pend = pendingByTech.get(t.id) ?? { count: 0, total: 0 };
    return {
      id: t.id,
      name: t.name,
      salary: p?.monthTotal ?? 0,
      addon: p?.monthAddon ?? 0,
      discount: p?.monthDiscount ?? 0,
      items: p?.totalItems ?? 0,
      points,
      achieved: points >= kpi,
      pendingCount: pend.count,
      pendingTotal: pend.total,
      finalized: p?.finalized ?? false,
    };
  });
  const finalizedCount = rows.filter((r) => r.finalized).length;

  // Aggregate KPIs
  const totalSalary = rows.reduce((s, r) => s + r.salary, 0);
  const achieversCount = rows.filter((r) => r.achieved).length;
  const avgPoints =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.points, 0) / rows.length)
      : 0;

  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <div className="p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">師傅薪資</h1>
          <p className="text-sm text-zinc-500">
            計件抽成、積分達標、待回繳一覽 · {month}
            {finalizedCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">
                <Lock className="h-3 w-3" /> 已結算 {finalizedCount}/{techs.length}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && finalizedCount < techs.length && (
            <FinalizeAllButton month={month} />
          )}
          <div className="flex items-center gap-1">
            <Link
              href={`/payroll?month=${prev}`}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              ← {prev}
            </Link>
            <span className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">
              {month}
            </span>
            <Link
              href={`/payroll?month=${next}`}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              {next} →
            </Link>
          </div>
        </div>
      </header>

      {/* 月度總覽 KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardBody className="py-3">
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <Wallet className="h-3.5 w-3.5" /> 本月總應發
            </p>
            <p className="font-mono text-xl font-bold text-zinc-900">
              {formatNTD(totalSalary)}
            </p>
            <p className="text-xs text-zinc-400">{techs.length} 位師傅</p>
          </CardBody>
        </Card>
        <Link href="/payroll/settlements">
          <Card className="transition-shadow hover:shadow-md">
            <CardBody className="py-3">
              <p className="flex items-center gap-1 text-xs text-zinc-500">
                <Coins className="h-3.5 w-3.5" /> 待回繳現金
              </p>
              <p
                className={`font-mono text-xl font-bold ${
                  totalPending > 0 ? "text-amber-700" : "text-zinc-900"
                }`}
              >
                {formatNTD(totalPending)}
              </p>
              <p className="text-xs text-zinc-400">
                {totalPendingCount} 筆 · 點此核帳
              </p>
            </CardBody>
          </Card>
        </Link>
        <Card>
          <CardBody className="py-3">
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <Trophy className="h-3.5 w-3.5" /> 積分達標
            </p>
            <p
              className={`text-xl font-bold ${
                achieversCount === techs.length && techs.length > 0
                  ? "text-emerald-700"
                  : "text-zinc-900"
              }`}
            >
              {achieversCount} / {techs.length}
            </p>
            <p className="text-xs text-zinc-400">
              月 KPI {kpi} 點{remaining != null ? ` · 剩 ${remaining} 天` : ""}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <TrendingUp className="h-3.5 w-3.5" /> 平均積分
            </p>
            <p className="text-xl font-bold text-zinc-900">{avgPoints}</p>
            <p className="text-xs text-zinc-400">本月各師傅平均</p>
          </CardBody>
        </Card>
      </div>

      {/* 師傅卡片清單 */}
      {rows.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-10">
            <Users className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">尚無啟用中的師傅</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const pct = Math.min(100, Math.round((r.points / kpi) * 100));
            const netAddon = r.addon - r.discount;
            return (
              <Link
                key={r.id}
                href={`/payroll/${r.id}?month=${month}`}
                className="group"
              >
                <Card className="transition-shadow group-hover:shadow-md">
                  <CardBody className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                        {r.name}
                        {r.achieved && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> 已達標
                          </span>
                        )}
                        {r.finalized && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700">
                            <Lock className="h-3 w-3" /> 已結算
                          </span>
                        )}
                      </p>
                      <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 transition-colors group-hover:text-brand-500" />
                    </div>

                    {/* Main 2-col: 薪資 / KPI */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-zinc-500">本月應發</p>
                        <p className="font-mono text-2xl font-bold text-zinc-900">
                          {formatNTD(r.salary)}
                        </p>
                        {(r.addon > 0 || r.discount > 0) && (
                          <p className="text-xs text-zinc-400">
                            +{formatNTD(r.addon)} / -{formatNTD(r.discount)}
                            <span className="ml-1">
                              （{netAddon >= 0 ? "+" : ""}
                              {formatNTD(netAddon)}）
                            </span>
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-zinc-600">積分 KPI</span>
                          <span
                            className={`font-mono font-semibold ${
                              r.achieved ? "text-emerald-700" : "text-zinc-700"
                            }`}
                          >
                            {r.points} / {kpi}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className={`h-full transition-all ${
                              r.achieved ? "bg-emerald-500" : "bg-amber-400"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {!r.achieved && remaining != null && (
                          <p className="mt-1 text-xs text-amber-700">
                            ⚠ 差 {kpi - r.points} 點，剩 {remaining} 天
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer: 件數 + 待回繳 */}
                    <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-xs">
                      <span className="text-zinc-500">
                        本月接案 <span className="font-semibold text-zinc-700">{r.items}</span> 件
                      </span>
                      {r.pendingTotal > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                          <Coins className="h-3 w-3" />
                          待回繳 {formatNTD(r.pendingTotal)}
                          <span className="text-amber-600">（{r.pendingCount}）</span>
                        </span>
                      ) : (
                        <span className="text-zinc-400">無待回繳</span>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* CSV export hint */}
      <div className="flex items-center justify-end">
        <p className="text-xs text-zinc-400">
          各師傅詳細頁可匯出 Excel 對帳檔
          <Download className="ml-1 inline h-3 w-3" />
        </p>
      </div>
    </div>
  );
}
