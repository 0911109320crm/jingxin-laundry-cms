import Link from "next/link";
import { ArrowRight, Phone, Wrench, History, MapPin } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { StatusBadge } from "@/components/orders/StatusBadges";
import { formatNTD } from "@/lib/utils";
import { formatTaipeiMonthDay } from "@/lib/timezone";
import { computeCustomerStats, formatMonths } from "@/lib/customer-stats";
import { MACHINE_TYPE_LABEL } from "@/lib/validators/customer";
import type { OrderInput } from "@/lib/validators/order";
import type { MachineType } from "@/types/database";

export type RecentOrder = {
  id: string;
  order_code: string;
  scheduled_at: string | null;
  total: number;
  status: OrderInput["status"];
};

export type CustomerMachine = {
  id: string;
  type: MachineType;
  brand: string | null;
  model: string | null;
  sub_type: string | null;
};

export type CustomerStatsOrder = {
  status: string;
  service_at: string | null;
  total: number;
};

export type CustomerPhone = {
  id: string;
  phone: string;
  label: string | null;
  is_primary: boolean;
  sort_order?: number;
};

type Props = {
  customer: {
    id: string;
    code: string;
    name: string;
    phone: string;
    source?: string | null;
    note?: string | null;
    phones?: CustomerPhone[];
  };
  address?: { county: string; district: string; address: string } | null;
  statsOrders: CustomerStatsOrder[];
  machines: CustomerMachine[];
  recentOrders: RecentOrder[];
};

// 鎖定台灣時區（避免跨日邊界在 UTC 環境誤判日期）。
const formatMonthDay = formatTaipeiMonthDay;

export function CustomerContextPanel({
  customer,
  address,
  statsOrders,
  machines,
  recentOrders,
}: Props) {
  const stats = computeCustomerStats(statsOrders);

  return (
    <Card>
      <CardBody className="space-y-3 p-0">
        {/* 客戶基本 */}
        <div className="space-y-1.5 px-4 pt-4">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/customers/${customer.id}`}
              className="min-w-0 truncate text-base font-semibold text-zinc-900 hover:underline"
            >
              {customer.name}
            </Link>
            <span className="shrink-0 font-mono text-xs text-zinc-400">
              {customer.code}
            </span>
          </div>
          {(() => {
            const sortedPhones = customer.phones
              ? [...customer.phones].sort(
                  (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
                )
              : [{
                  id: "fallback",
                  phone: customer.phone,
                  label: null,
                  is_primary: true,
                }];
            return (
              <div className="space-y-0.5">
                {sortedPhones.map((p) => (
                  <a
                    key={p.id}
                    href={`tel:${p.phone}`}
                    className={`flex items-center gap-1.5 text-sm ${
                      p.is_primary
                        ? "font-medium text-brand-700"
                        : "text-zinc-600"
                    }`}
                  >
                    <Phone className="h-3.5 w-3.5" /> {p.phone}
                    {p.label && (
                      <span className="text-xs text-zinc-500">
                        ({p.label})
                      </span>
                    )}
                  </a>
                ))}
              </div>
            );
          })()}
          {customer.source && (
            <p className="text-xs text-zinc-500">來源：{customer.source}</p>
          )}
          {address && (
            <p className="flex items-start gap-1.5 text-xs text-zinc-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <span>
                {address.county} {address.district} {address.address}
              </span>
            </p>
          )}
          {customer.note && (
            <p className="rounded bg-zinc-50 px-2 py-1 text-xs text-zinc-600">
              {customer.note}
            </p>
          )}
          <Link
            href={`/customers/${customer.id}`}
            className="inline-flex items-center gap-1 pt-0.5 text-xs text-zinc-500 hover:text-brand-700"
          >
            客戶完整資料 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* 統計 2x2 */}
        <div className="grid grid-cols-2 gap-y-1.5 border-t border-zinc-200 px-4 py-3 text-xs">
          <div>
            <p className="text-zinc-400">累計消費</p>
            <p className="font-mono text-sm font-semibold text-zinc-900">
              {formatNTD(stats.totalSpent)}
            </p>
          </div>
          <div>
            <p className="text-zinc-400">完工次數</p>
            <p className="font-mono text-sm font-semibold text-zinc-900">
              {stats.doneCount}
            </p>
          </div>
          <div>
            <p className="text-zinc-400">最後服務</p>
            <p className="text-sm font-semibold text-zinc-900">
              {stats.monthsSinceLast == null
                ? "—"
                : `${formatMonths(stats.monthsSinceLast)}前`}
            </p>
          </div>
          <div>
            <p className="text-zinc-400">平均週期</p>
            <p className="text-sm font-semibold text-zinc-900">
              {formatMonths(stats.avgCycleMonths)}
            </p>
          </div>
        </div>

        {/* 機器清單 */}
        <div className="border-t border-zinc-200 px-4 py-3">
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-zinc-500">
            <Wrench className="h-3.5 w-3.5" /> 客戶機器（{machines.length}）
          </p>
          {machines.length === 0 ? (
            <p className="text-xs text-zinc-400">尚未登錄機器</p>
          ) : (
            <ul className="space-y-1">
              {machines.map((m) => (
                <li key={m.id} className="text-xs text-zinc-700">
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700">
                    {MACHINE_TYPE_LABEL[m.type] ?? m.type}
                  </span>
                  <span className="ml-1.5 text-zinc-500">
                    {[m.brand, m.model].filter(Boolean).join(" ") || "未填型號"}
                    {m.sub_type ? ` · ${m.sub_type}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 最近訂單 */}
        <div className="border-t border-zinc-200 px-4 py-3">
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-zinc-500">
            <History className="h-3.5 w-3.5" /> 最近訂單（不含本筆）
          </p>
          {recentOrders.length === 0 ? (
            <p className="text-xs text-zinc-400">沒有其他訂單</p>
          ) : (
            <ul className="-mx-2 space-y-0.5">
              {recentOrders.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/orders/${r.id}`}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-zinc-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5">
                        <span className="font-mono text-zinc-500">
                          {r.order_code}
                        </span>
                        <StatusBadge value={r.status} />
                      </p>
                      <p className="text-zinc-400">
                        {formatMonthDay(r.scheduled_at)}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-zinc-900">
                      {formatNTD(r.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
