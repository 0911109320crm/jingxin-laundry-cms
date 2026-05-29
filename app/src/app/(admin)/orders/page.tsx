import Link from "next/link";
import { Plus, Search, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardBody } from "@/components/ui/Card";
import {
  StatusBadge,
  PaymentBadge,
  SettlementBadge,
} from "@/components/orders/StatusBadges";
import { formatDate, formatNTD, cn } from "@/lib/utils";
import { type OrderInput } from "@/lib/validators/order";
import { QuickDeleteOrderButton } from "./QuickDeleteOrderButton";

type SP = Promise<{
  q?: string;
  status?: string;
  payment?: string;
  settlement?: string;
  tech?: string;
  from?: string;
  to?: string;
  all?: string;
}>;

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 計算預設日期範圍：今天回推 3 個月 ~ 今天往後 1 個月
function getDefaultDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setMonth(from.getMonth() - 3);
  const to = new Date(today);
  to.setMonth(to.getMonth() + 1);
  return { from: toISODate(from), to: toISODate(to) };
}

const ORDERS_LIMIT = 2000;

type Row = {
  id: string;
  order_code: string;
  scheduled_at: string | null;
  service_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  status: OrderInput["status"];
  payment_method: OrderInput["payment_method"];
  settlement_status: "pending" | "settled" | "not_required";
  total: number;
  note: string | null;
  customer: {
    name: string;
    phone: string;
    code: string;
    phones: { id: string; phone: string; label: string | null; is_primary: boolean }[];
  } | null;
  address: { county: string; district: string } | null;
};

const TABS = [
  { label: "全部",   value: "" },
  { label: "待派工", value: "pending" },
  { label: "已排案", value: "scheduled" },
  { label: "已完成", value: "done" },
  { label: "已取消", value: "cancelled" },
] as const;

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  await requireRole(["owner", "manager"]);
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "";
  const payment = sp.payment ?? "";
  const settlement = sp.settlement ?? "";
  const tech = sp.tech ?? "";

  // 日期範圍篩選
  // - all=1 → 不套用日期 filter（全部時間）
  // - 沒帶 from/to → 預設「近 3 個月 ~ 未來 1 個月」
  // - 待派工（scheduled_at IS NULL）永遠納入，不被日期 filter 過濾
  const isAllTime = sp.all === "1";
  const defaults = getDefaultDateRange();
  const from = isAllTime ? "" : (sp.from ?? defaults.from);
  const to = isAllTime ? "" : (sp.to ?? defaults.to);

  const supabase = await createClient();
  const admin = createAdminClient();

  // 撈所有 active 師傅給篩選下拉用
  const { data: techData } = await admin
    .from("user_profiles")
    .select("id, name")
    .eq("role", "technician")
    .eq("active", true)
    .order("name");
  const technicians =
    (techData as { id: string; name: string }[] | null) ?? [];
  const techName = tech
    ? technicians.find((t) => t.id === tech)?.name ?? null
    : null;

  // 若有師傅篩選，先撈該師傅有做過項目的 order_id
  let techOrderIds: string[] | null = null;
  if (tech) {
    const { data: itemRows } = await supabase
      .from("order_items")
      .select("order_id")
      .eq("technician_id", tech);
    techOrderIds = Array.from(
      new Set(
        ((itemRows as { order_id: string }[] | null) ?? []).map(
          (r) => r.order_id,
        ),
      ),
    );
  }

  let query = supabase
    .from("orders")
    .select(
      `id, order_code, scheduled_at, service_at, cancelled_at, cancellation_reason,
       status, payment_method, settlement_status, total, note,
       customer:customers(name, phone, code, phones:customer_phones(id, phone, label, is_primary)),
       address:customer_addresses(county, district)`,
    )
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .limit(ORDERS_LIMIT);

  if (status) query = query.eq("status", status);
  if (payment) query = query.eq("payment_method", payment);
  if (settlement) query = query.eq("settlement_status", settlement);

  // 日期範圍：待派工（scheduled_at IS NULL）永遠納入
  if (from && to) {
    query = query.or(
      `scheduled_at.is.null,and(scheduled_at.gte.${from},scheduled_at.lte.${to}T23:59:59)`,
    );
  } else if (from) {
    query = query.or(`scheduled_at.is.null,scheduled_at.gte.${from}`);
  } else if (to) {
    query = query.or(`scheduled_at.is.null,scheduled_at.lte.${to}T23:59:59`);
  }
  if (techOrderIds !== null) {
    if (techOrderIds.length === 0) {
      // 該師傅沒有任何訂單，直接限制成空結果
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.in("id", techOrderIds);
    }
  }
  if (q) {
    const like = `%${q}%`;
    query = query.or(`order_code.ilike.${like},note.ilike.${like}`);
  }

  const { data } = await query;
  const rows = (data as Row[] | null) ?? [];

  const totalAmount = rows.reduce((s, r) => s + Number(r.total), 0);
  const doneAmount = rows
    .filter((r) => r.status === "done")
    .reduce((s, r) => s + Number(r.total), 0);
  const doneCount = rows.filter((r) => r.status === "done").length;

  const isCancelledTab = status === "cancelled";

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900">訂單管理</h1>
          <p className="text-sm text-zinc-500">
            可按狀態、收款、回繳篩選；廣義搜尋訂單編號 / 備註
          </p>
        </div>
        <Link href="/orders/new" className="shrink-0">
          <Button>
            <Plus className="h-4 w-4" /> 新增訂單
          </Button>
        </Link>
      </header>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-zinc-200">
        {TABS.map((tab) => {
          const active = status === tab.value;
          const params = new URLSearchParams();
          if (tab.value) params.set("status", tab.value);
          if (q) params.set("q", q);
          if (tech) params.set("tech", tech);
          const qs = params.toString();
          const href = qs ? `/orders?${qs}` : "/orders";
          return (
            <Link
              key={tab.value}
              href={href}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-zinc-500 hover:text-zinc-700",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardBody className="space-y-3">
          {/* 日期範圍 + 快捷 */}
          {(() => {
            const today = new Date();
            const todayStr = toISODate(today);
            const monthStart = toISODate(new Date(today.getFullYear(), today.getMonth(), 1));
            const threeMonAgo = toISODate(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()));
            const sixMonAgo = toISODate(new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()));
            const yearStart = toISODate(new Date(today.getFullYear(), 0, 1));
            const oneMonAhead = toISODate(new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()));

            const presets = [
              { label: "本月", from: monthStart, to: todayStr, all: false },
              { label: "近 3 個月", from: threeMonAgo, to: oneMonAhead, all: false },
              { label: "近 6 個月", from: sixMonAgo, to: oneMonAhead, all: false },
              { label: "今年", from: yearStart, to: oneMonAhead, all: false },
              { label: "全部時間", from: "", to: "", all: true },
            ];

            const isPresetActive = (p: typeof presets[number]) => {
              if (p.all) return isAllTime;
              return !isAllTime && from === p.from && to === p.to;
            };

            const buildPresetHref = (p: typeof presets[number]) => {
              const params = new URLSearchParams();
              if (status) params.set("status", status);
              if (payment) params.set("payment", payment);
              if (settlement) params.set("settlement", settlement);
              if (tech) params.set("tech", tech);
              if (q) params.set("q", q);
              if (p.all) params.set("all", "1");
              else {
                params.set("from", p.from);
                params.set("to", p.to);
              }
              return `/orders?${params.toString()}`;
            };

            return (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-zinc-500">期間：</span>
                {presets.map((p) => (
                  <Link
                    key={p.label}
                    href={buildPresetHref(p)}
                    className={cn(
                      "rounded-full px-3 py-1 transition-colors",
                      isPresetActive(p)
                        ? "bg-brand-600 text-white"
                        : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100",
                    )}
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            );
          })()}

          <form className={cn(
            "grid grid-cols-1 gap-3",
            isCancelledTab
              ? "md:grid-cols-[1fr_140px_140px_160px_auto]"
              : "md:grid-cols-[1fr_140px_140px_140px_140px_140px_140px_auto]",
          )}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="搜尋訂單編號 / 備註"
                className="pl-9"
              />
            </div>
            {/* Date range inputs */}
            <Input
              type="date"
              name="from"
              defaultValue={isAllTime ? "" : from}
              title="起始日期"
            />
            <Input
              type="date"
              name="to"
              defaultValue={isAllTime ? "" : to}
              title="結束日期"
            />
            {/* Keep hidden status so tab selection survives form submit */}
            {status && <input type="hidden" name="status" value={status} />}
            {!isCancelledTab && (
              <>
                <Select name="payment" defaultValue={payment}>
                  <option value="">— 全部收款 —</option>
                  <option value="unpaid">未收款</option>
                  <option value="cash">已收款-現金</option>
                  <option value="transfer">已收款-匯款</option>
                  <option value="card">已收款-刷卡</option>
                  <option value="line_pay">已收款-LINE Pay</option>
                </Select>
                <Select name="settlement" defaultValue={settlement}>
                  <option value="">— 全部回繳 —</option>
                  <option value="pending">待回繳</option>
                  <option value="settled">已回繳</option>
                  <option value="not_required">免回繳</option>
                </Select>
              </>
            )}
            <Select name="tech" defaultValue={tech}>
              <option value="">— 全部師傅 —</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Button type="submit">套用</Button>
          </form>
        </CardBody>
      </Card>

      {tech && techName && (
        <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50/50 px-4 py-2 text-sm">
          <span className="text-brand-900">
            正在篩選 <span className="font-semibold">{techName}</span> 的訂單
            （操作視角；月度薪資總計請看師傅薪資頁）
          </span>
          <Link
            href={`/payroll/${tech}?month=${currentMonthValue()}`}
            className="inline-flex items-center gap-1 text-brand-700 hover:underline"
          >
            <Wallet className="h-4 w-4" /> 本月薪資 →
          </Link>
        </div>
      )}

      {rows.length >= ORDERS_LIMIT && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ 篩選結果達到 {ORDERS_LIMIT} 筆上限，可能有更舊的訂單沒列出。請縮短日期範圍或加上其他篩選條件。
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs text-zinc-500">篩選結果</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">
              {rows.length} 筆
              {!isAllTime && from && to && (
                <span className="ml-2 text-xs font-normal text-zinc-500">（{from} ~ {to}）</span>
              )}
              {isAllTime && (
                <span className="ml-2 text-xs font-normal text-zinc-500">（全部時間）</span>
              )}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-zinc-500">總金額（含未完成）</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900 font-mono">
              {formatNTD(totalAmount)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-zinc-500">已完成金額 / 件數</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700 font-mono">
              {formatNTD(doneAmount)}
            </p>
            <p className="text-xs text-zinc-400">{doneCount} 筆已完成</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-500">沒有訂單</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {rows.map((o) => (
                <li key={o.id} className="flex items-stretch">
                  <Link
                    href={`/orders/${o.id}`}
                    className="flex flex-1 min-w-0 flex-col gap-2 px-5 py-3 transition-colors hover:bg-zinc-50 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-zinc-500">
                          {o.order_code}
                        </span>
                        <StatusBadge value={o.status} />
                        {!isCancelledTab && (
                          <>
                            <PaymentBadge value={o.payment_method} />
                            <SettlementBadge value={o.settlement_status} />
                          </>
                        )}
                      </div>
                      <p className="text-sm">
                        <span className="font-medium text-zinc-900">
                          {o.customer?.name ?? "—"}
                        </span>
                        <span className="text-zinc-500"> · {o.customer?.phone}
                          {o.customer?.phones && o.customer.phones.length > 1 && (
                            <span
                              className="ml-1 rounded bg-zinc-100 px-1 text-[10px] text-zinc-600"
                              title={o.customer.phones
                                .filter((p) => !p.is_primary)
                                .map((p) => `${p.phone}${p.label ? `（${p.label}）` : ""}`)
                                .join("、")}
                            >
                              +{o.customer.phones.length - 1}
                            </span>
                          )}
                        </span>
                        {o.address && (
                          <span className="text-zinc-500">
                            {" "}· {o.address.county} {o.address.district}
                          </span>
                        )}
                      </p>
                      {isCancelledTab && o.cancellation_reason && (
                        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-0.5 inline-block">
                          取消原因：{o.cancellation_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-xs text-zinc-400">
                          預約：{formatDate(o.scheduled_at)}
                        </p>
                        {isCancelledTab && o.cancelled_at ? (
                          <p className="text-xs text-red-400">
                            取消：{formatDate(o.cancelled_at)}
                          </p>
                        ) : o.service_at ? (
                          <p className="text-xs text-zinc-400">
                            完工：{formatDate(o.service_at)}
                          </p>
                        ) : null}
                      </div>
                      <p className={cn(
                        "text-base font-semibold font-mono",
                        isCancelledTab ? "text-zinc-400 line-through" : "text-zinc-900",
                      )}>
                        {formatNTD(o.total)}
                      </p>
                    </div>
                  </Link>
                  {o.status === "pending" && (
                    <div className="flex items-center pr-3">
                      <QuickDeleteOrderButton
                        id={o.id}
                        orderCode={o.order_code}
                        customerName={o.customer?.name ?? "—"}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
