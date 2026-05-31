import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Download,
  Trophy,
  Wallet,
  Coins,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { fetchPayroll } from "@/lib/payroll";
import { resolveCollector } from "@/lib/settlement";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate, formatNTD } from "@/lib/utils";
import { MonthlyAdjustmentsPanel } from "./MonthlyAdjustmentsPanel";
import { FinalizeButtons } from "./FinalizeButtons";

type Params = Promise<{ user_id: string }>;
type SP = Promise<{ month?: string }>;

function currentMonth() {
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
  if (today.getFullYear() !== y || today.getMonth() !== m - 1) return null;
  return Math.max(0, lastDay - today.getDate());
}

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "未收",
  cash: "現金",
  transfer: "匯款",
  card: "刷卡",
  line_pay: "LINE Pay",
};

export default async function TechnicianPayrollPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SP;
}) {
  const me = await requireRole(["owner", "manager"]);
  const isOwner = me.profile.role === "owner";
  const { user_id } = await params;
  const sp = await searchParams;
  const month = sp.month ?? currentMonth();
  const data = await fetchPayroll(user_id, month);
  if (!data) notFound();

  const { start, end } = monthRange(month);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const remaining = daysLeftInMonth(month);

  const supabase = await createClient();
  const admin = createAdminClient();

  // 撈該師傅本月積分明細 + KPI 設定 + 待回繳訂單
  const [{ data: promosRaw }, { data: kpiRow }, { data: pendingRaw }] =
    await Promise.all([
      admin
        .from("order_promotions")
        .select(
          "id, points_snapshot, created_at, type:promotion_types(label), order:orders(order_code, customer:customers(name))",
        )
        .eq("credited_to", user_id)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false }),
      admin
        .from("system_settings")
        .select("value")
        .eq("key", "monthly_promotion_kpi")
        .maybeSingle(),
      supabase
        .from("orders")
        .select(
          "id, order_code, total, service_at, scheduled_at, collected_by_technician_id, customer:customers(name), items:order_items(technician_id, created_at)",
        )
        .eq("payment_method", "cash")
        .eq("settlement_status", "pending")
        .order("service_at", { ascending: true, nullsFirst: false }),
    ]);

  type PromoRow = {
    id: string;
    points_snapshot: number;
    created_at: string;
    type: { label: string } | null;
    order: { order_code: string; customer: { name: string } | null } | null;
  };
  const promos = (promosRaw as PromoRow[] | null) ?? [];
  const kpi = typeof kpiRow?.value === "number" ? kpiRow.value : 30;
  const totalPoints = promos.reduce((s, p) => s + Number(p.points_snapshot), 0);
  const achieved = totalPoints >= kpi;
  const pct = Math.min(100, Math.round((totalPoints / kpi) * 100));

  // Pending settlements this technician actually collected (fallback: earliest item)
  type PendingOrder = {
    id: string;
    order_code: string;
    total: number;
    service_at: string | null;
    scheduled_at: string | null;
    collected_by_technician_id: string | null;
    customer: { name: string } | null;
    items: { technician_id: string | null; created_at: string }[];
  };
  const allPending = (pendingRaw as PendingOrder[] | null) ?? [];
  const myPending = allPending.filter(
    (o) => resolveCollector(o.collected_by_technician_id, o.items) === user_id,
  );
  const myPendingTotal = myPending.reduce((s, o) => s + Number(o.total), 0);

  // 按促銷類型聚合
  const byType = new Map<string, { label: string; count: number; points: number }>();
  for (const p of promos) {
    const label = p.type?.label ?? "(已刪除)";
    const cur = byType.get(label) ?? { label, count: 0, points: 0 };
    cur.count += 1;
    cur.points += Number(p.points_snapshot);
    byType.set(label, cur);
  }
  const typeStats = Array.from(byType.values()).sort(
    (a, b) => b.points - a.points,
  );

  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const netAddon = data.monthAddon - data.monthDiscount;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/payroll?month=${month}`}
          className="inline-flex shrink-0 items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ChevronLeft className="h-4 w-4" /> 回師傅薪資
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href={`/orders?tech=${user_id}`}>
            <Button variant="outline" size="sm">
              <ClipboardList className="h-4 w-4" /> 看這位師傅所有訂單
            </Button>
          </Link>
          <a
            href={`/api/payroll/export?user=${user_id}&month=${month}`}
            target="_blank"
          >
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" /> 匯出 Excel
            </Button>
          </a>
          <FinalizeButtons
            technicianId={user_id}
            month={month}
            techName={data.technician.name}
            finalized={data.finalized}
            isOwner={isOwner}
          />
        </div>
      </div>

      {data.finalized && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          ✓ 此月份已於結算當下凍結快照。改抽成設定不影響此頁數字。
        </div>
      )}

      {/* Hero: 本月實領大字 + 月份切換 */}
      <Card>
        <CardBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-zinc-500">
              {data.technician.name} · {data.year} 年 {data.month} 月
            </p>
            <p className="mt-1 font-mono text-4xl font-bold text-zinc-900">
              {formatNTD(data.monthTotal)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              本月應發（已含加減項）· 接案 {data.totalItems} 件
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={`/payroll/${user_id}?month=${prev}`}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              ← {prev}
            </Link>
            <span className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">
              {month}
            </span>
            <Link
              href={`/payroll/${user_id}?month=${next}`}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              {next} →
            </Link>
          </div>
        </CardBody>
      </Card>

      {/* 重點 KPI 4 卡 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardBody className="py-3">
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <Wallet className="h-3.5 w-3.5" /> 計件抽成
            </p>
            <p className="font-mono text-lg font-bold text-zinc-900">
              {formatNTD(data.monthBaseCommission)}
            </p>
            <p className="text-xs text-zinc-400">{data.totalItems} 件項目</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <TrendingUp className="h-3.5 w-3.5" /> 加減項（進薪資）
            </p>
            <p
              className={`font-mono text-lg font-bold ${
                netAddon >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {netAddon >= 0 ? "+" : ""}
              {formatNTD(netAddon)}
            </p>
            <p className="text-xs text-zinc-400">
              加 {formatNTD(data.monthAddon)} / 減 {formatNTD(data.monthDiscount)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <Trophy className="h-3.5 w-3.5" /> 積分達標
            </p>
            <p
              className={`text-lg font-bold ${
                achieved ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {totalPoints} / {kpi}
            </p>
            <p className="text-xs text-zinc-400">
              {achieved ? "✓ 已達標" : `差 ${kpi - totalPoints} 點`}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <Coins className="h-3.5 w-3.5" /> 待回繳現金
            </p>
            <p
              className={`font-mono text-lg font-bold ${
                myPendingTotal > 0 ? "text-amber-700" : "text-zinc-900"
              }`}
            >
              {formatNTD(myPendingTotal)}
            </p>
            <p className="text-xs text-zinc-400">{myPending.length} 筆</p>
          </CardBody>
        </Card>
      </div>

      {/* 積分 KPI 區塊 */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            積分 KPI 進度
          </CardTitle>
          {achieved ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> 已達標
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> 未達標
            </span>
          )}
        </CardHeader>
        <CardBody className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-zinc-600">
                目前 {totalPoints} 點 / 月 KPI {kpi} 點（{pct}%）
              </span>
              {!achieved && remaining != null && (
                <span className="text-xs text-amber-700">
                  本月剩 {remaining} 天
                </span>
              )}
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full transition-all ${
                  achieved ? "bg-emerald-500" : "bg-amber-400"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* 促銷類型分布 */}
          {typeStats.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {typeStats.map((t) => (
                <div
                  key={t.label}
                  className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs"
                >
                  <p className="text-zinc-600">{t.label}</p>
                  <p className="font-semibold text-zinc-900">
                    {t.count} 次 · {t.points} 點
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 本月積分訂單 */}
          {promos.length === 0 ? (
            <p className="text-xs text-zinc-400">本月尚未取得任何積分</p>
          ) : (
            <details className="rounded-lg bg-zinc-50">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-700">
                展開明細（{promos.length} 筆）
              </summary>
              <ul className="divide-y divide-zinc-200 px-3 pb-2">
                {promos.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 py-1.5 text-xs"
                  >
                    <span className="text-zinc-600">
                      {p.type?.label ?? "—"} ·{" "}
                      <Link
                        href={`/orders/${(p as unknown as { order_id?: string }).order_id ?? ""}`}
                        className="text-zinc-500 hover:text-brand-700"
                      >
                        {p.order?.order_code ?? ""}
                      </Link>{" "}
                      · {p.order?.customer?.name ?? ""}
                    </span>
                    <span className="font-mono font-semibold text-zinc-900">
                      +{p.points_snapshot}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardBody>
      </Card>

      <MonthlyAdjustmentsPanel
        technicianId={user_id}
        month={month}
        adjustments={data.monthlyAdjustments}
        bonusTotal={data.monthBonus}
        deductionTotal={data.monthDeduction}
        finalized={data.finalized}
      />

      {/* 待回繳訂單區塊 */}
      {myPending.length > 0 && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-500" />
              待回繳訂單（{myPending.length} 筆）
            </CardTitle>
            <Link
              href="/payroll/settlements"
              className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"
            >
              去核帳 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-zinc-200">
              {myPending.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}?from=settlements`}
                    className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm hover:bg-zinc-50"
                  >
                    <div>
                      <p className="flex items-center gap-2">
                        <span className="font-mono text-xs text-zinc-500">
                          {o.order_code}
                        </span>
                        <span className="font-medium text-zinc-900">
                          {o.customer?.name ?? "—"}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatDate(o.service_at ?? o.scheduled_at)}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-amber-700">
                      {formatNTD(o.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-zinc-200 px-5 py-2.5 text-right">
              <span className="text-xs text-zinc-500">合計</span>{" "}
              <span className="font-mono text-lg font-bold text-amber-700">
                {formatNTD(myPendingTotal)}
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 每日明細 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-zinc-500" />
            每日明細
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <ul className="divide-y divide-zinc-200">
            {data.rows
              .filter((row) => row.items.length > 0)
              .map((row) => {
                const dayNet = row.dayCommission + row.dayAddon - row.dayDiscount;
                return (
                  <li key={row.day}>
                    <details className="group">
                      <summary className="grid cursor-pointer grid-cols-1 md:grid-cols-[60px_1fr_auto] md:items-center gap-3 px-5 py-2.5 text-sm hover:bg-zinc-50">
                        <span className="font-mono text-zinc-700">
                          {data.month}/{String(row.day).padStart(2, "0")}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {row.items.length} 件
                          {row.dayAddon > 0 && (
                            <span className="ml-2 text-emerald-700">
                              +{formatNTD(row.dayAddon)}
                            </span>
                          )}
                          {row.dayDiscount > 0 && (
                            <span className="ml-2 text-rose-700">
                              -{formatNTD(row.dayDiscount)}
                            </span>
                          )}
                          {row.transferredCount > 0 && (
                            <span className="ml-2 inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
                              匯款 {row.transferredCount}
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-semibold text-zinc-900">
                          {formatNTD(dayNet)}
                        </span>
                      </summary>
                      <div className="bg-zinc-50/60 px-5 py-2">
                        <ul className="space-y-1.5">
                          {row.items.map((it) => (
                            <li
                              key={it.id}
                              className="space-y-0.5 text-xs"
                            >
                              <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                                <Link
                                  href={`/orders/${it.order_id}`}
                                  className="flex items-center gap-2 text-zinc-700 hover:text-brand-700 hover:underline"
                                >
                                  <span className="font-mono text-zinc-400">
                                    {it.order_code}
                                  </span>
                                  <span className="font-medium">
                                    {it.customer_name}
                                  </span>
                                  <span className="text-zinc-500">
                                    {it.service_name ?? "—"}
                                    {it.tag ? ` · ${it.tag}` : ""}
                                  </span>
                                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
                                    {PAYMENT_LABEL[it.payment_method] ?? it.payment_method}
                                  </span>
                                </Link>
                                <span className="text-right">
                                  <span className="font-mono font-semibold text-zinc-900">
                                    {formatNTD(it.commission_amount)}
                                  </span>
                                  <span className="ml-1 text-zinc-400">
                                    ({it.commission_label} of {formatNTD(it.subtotal)})
                                  </span>
                                </span>
                              </div>
                              {(it.order_addons_detail.length > 0 ||
                                it.order_discount_detail.length > 0) && (
                                <div className="ml-2 flex flex-wrap gap-1.5 pl-4 border-l-2 border-zinc-200">
                                  {it.order_addons_detail.map((a, i) => (
                                    <span
                                      key={`a-${i}`}
                                      className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700"
                                    >
                                      {a.name} +{formatNTD(a.amount)}
                                    </span>
                                  ))}
                                  {it.order_discount_detail.map((d, i) => (
                                    <span
                                      key={`d-${i}`}
                                      className="inline-flex items-center rounded bg-rose-50 px-1.5 py-0.5 text-rose-700"
                                    >
                                      {d.name} -{formatNTD(d.amount)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  </li>
                );
              })}
            {data.rows.every((r) => r.items.length === 0) && (
              <li className="px-5 py-6 text-center text-sm text-zinc-400">
                本月尚無接案
              </li>
            )}
          </ul>
          {/* 月底總計 */}
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-t-2 border-zinc-300 bg-zinc-50 px-5 py-3 text-sm font-semibold">
            <span className="text-zinc-700">本月應發合計</span>
            <span className="font-mono text-lg text-zinc-900">
              {formatNTD(data.monthTotal)}
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
