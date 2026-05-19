import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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

type SP = Promise<{
  q?: string;
  status?: string;
  payment?: string;
  settlement?: string;
}>;

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
  customer: { name: string; phone: string; code: string } | null;
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

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      `id, order_code, scheduled_at, service_at, cancelled_at, cancellation_reason,
       status, payment_method, settlement_status, total, note,
       customer:customers(name, phone, code),
       address:customer_addresses(county, district)`,
    )
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .limit(300);

  if (status) query = query.eq("status", status);
  if (payment) query = query.eq("payment_method", payment);
  if (settlement) query = query.eq("settlement_status", settlement);
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
    <div className="p-8 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">訂單管理</h1>
          <p className="text-sm text-zinc-500">
            可按狀態、收款、回繳篩選；廣義搜尋訂單編號 / 備註
          </p>
        </div>
        <Link href="/orders/new">
          <Button>
            <Plus className="h-4 w-4" /> 新增訂單
          </Button>
        </Link>
      </header>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-zinc-200">
        {TABS.map((tab) => {
          const active = status === tab.value;
          const href = tab.value
            ? `/orders?status=${tab.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`
            : `/orders${q ? `?q=${encodeURIComponent(q)}` : ""}`;
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
        <CardBody>
          <form className={cn(
            "grid grid-cols-1 gap-3",
            isCancelledTab
              ? "md:grid-cols-[1fr_auto]"
              : "md:grid-cols-[1fr_160px_180px_160px_auto]",
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
            <Button type="submit">套用</Button>
          </form>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs text-zinc-500">篩選結果</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">
              {rows.length} 筆
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
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="flex flex-col gap-2 px-5 py-3 transition-colors hover:bg-zinc-50 md:flex-row md:items-center md:justify-between"
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
                        <span className="text-zinc-500"> · {o.customer?.phone}</span>
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
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
