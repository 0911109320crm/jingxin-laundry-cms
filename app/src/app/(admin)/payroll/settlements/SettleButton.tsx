"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCheck, Check, ExternalLink } from "lucide-react";
import { settleOrdersAction } from "@/app/(admin)/orders/actions";
import { Button } from "@/components/ui/Button";
import { formatDate, formatNTD } from "@/lib/utils";

export type PendingOrderLite = {
  id: string;
  order_code: string;
  total: number;
  service_at: string | null;
  scheduled_at: string | null;
  customer_name: string;
  area: string | null;
};

/**
 * Per-technician group with selective settlement.
 * - Per-row checkbox
 * - Bulk "select all" + "settle selected" + "settle all" buttons
 * - Each row has link to order detail (with ?from=settlements)
 */
export function SettleGroup({
  technicianName,
  orders,
}: {
  technicianName: string;
  orders: PendingOrderLite[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const allSelected = selected.size === orders.length && orders.length > 0;
  const someSelected = selected.size > 0;
  const selectedTotal = orders
    .filter((o) => selected.has(o.id))
    .reduce((s, o) => s + Number(o.total), 0);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(orders.map((o) => o.id)));
  };

  const settleIds = (ids: string[], label: string) => {
    if (ids.length === 0) return;
    if (
      !confirm(
        `確認 ${technicianName} 已交來現金 ${formatNTD(
          orders
            .filter((o) => ids.includes(o.id))
            .reduce((s, o) => s + Number(o.total), 0),
        )}（${ids.length} 筆 · ${label}）？\n標記後將從待回繳清單移除。`,
      )
    )
      return;
    startTransition(async () => {
      const res = await settleOrdersAction(ids);
      if (!res.ok) alert(res.error);
      else setSelected(new Set());
    });
  };

  return (
    <div>
      {/* 全選列 */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-2 text-xs">
        <label className="flex cursor-pointer items-center gap-2 text-zinc-600">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
          />
          {allSelected ? "取消全選" : "全選"}（{orders.length} 筆）
        </label>
        {someSelected && (
          <span className="text-brand-700">
            已選 {selected.size} 筆 · {formatNTD(selectedTotal)}
          </span>
        )}
      </div>

      {/* 訂單清單 */}
      <ul className="divide-y divide-zinc-200">
        {orders.map((o) => {
          const isSelected = selected.has(o.id);
          return (
            <li
              key={o.id}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isSelected ? "bg-brand-50/40" : "hover:bg-zinc-50"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(o.id)}
                className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-zinc-400">
                    {o.order_code}
                  </span>
                  <span className="font-medium text-zinc-900">
                    {o.customer_name}
                  </span>
                  <Link
                    href={`/orders/${o.id}?from=settlements`}
                    className="inline-flex items-center gap-0.5 text-xs text-zinc-500 hover:text-brand-700"
                    title="查看訂單明細"
                  >
                    查看 <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <p className="text-xs text-zinc-500">
                  {o.area && `${o.area} · `}
                  {formatDate(o.service_at ?? o.scheduled_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-zinc-900">
                  {formatNTD(o.total)}
                </span>
                <button
                  type="button"
                  onClick={() => settleIds([o.id], o.order_code)}
                  disabled={pending}
                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  title="標記這筆已回繳"
                >
                  <Check className="inline h-3 w-3" /> 已回繳
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* 底部批次按鈕 */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || !someSelected}
          onClick={() =>
            settleIds(Array.from(selected), `${selected.size} 筆選取項`)
          }
        >
          <Check className="h-4 w-4" />
          標記選取為已回繳（{selected.size}）
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending || orders.length === 0}
          onClick={() =>
            settleIds(
              orders.map((o) => o.id),
              `全部 ${orders.length} 筆`,
            )
          }
        >
          <CheckCheck className="h-4 w-4" />
          全部標記已回繳
        </Button>
      </div>
    </div>
  );
}
