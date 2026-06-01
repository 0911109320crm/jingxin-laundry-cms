"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, CheckCircle2 } from "lucide-react";
import { settleOrdersAction } from "@/app/(admin)/orders/actions";
import { Button } from "@/components/ui/Button";
import { formatNTD } from "@/lib/utils";

export type TransferRow = {
  id: string;
  order_code: string;
  total: number;
  date: string | null;
  customer_name: string;
  area: string | null;
  transfer_last5: string | null;
};

export function TransferReconcile({ orders }: { orders: TransferRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        (o.transfer_last5 ?? "").includes(q) ||
        o.customer_name.includes(q) ||
        o.order_code.includes(q),
    );
  }, [orders, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedTotal = orders
    .filter((o) => selected.has(o.id))
    .reduce((s, o) => s + o.total, 0);

  const settle = (ids: string[]) => {
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await settleOrdersAction(ids);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  };

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <CheckCircle2 className="h-10 w-10 text-zinc-300" />
        <p className="text-sm text-zinc-500">目前沒有待對帳的轉帳訂單</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 focus-within:border-brand-500">
        <Search className="h-4 w-4 shrink-0 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="用後五碼 / 客戶 / 訂單編號搜尋…"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2">
          <span className="text-sm text-brand-800">
            已選 {selected.size} 筆 · {formatNTD(selectedTotal)}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => settle(Array.from(selected))}
          >
            <CheckCircle2 className="h-4 w-4" /> 標記已入帳
          </Button>
        </div>
      )}

      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200">
        {filtered.map((o) => (
          <li
            key={o.id}
            className="flex items-center gap-3 bg-white px-3 py-2.5"
          >
            <input
              type="checkbox"
              checked={selected.has(o.id)}
              onChange={() => toggle(o.id)}
              className="h-4 w-4 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-zinc-900">
                  {o.customer_name}
                </span>
                <Link
                  href={`/orders/${o.id}`}
                  className="shrink-0 font-mono text-xs text-zinc-400 hover:text-brand-600"
                >
                  {o.order_code}
                </Link>
              </div>
              <p className="truncate text-xs text-zinc-500">
                {o.date?.slice(0, 10) ?? "—"}
                {o.area ? ` · ${o.area}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-sm font-bold text-zinc-900">
                {formatNTD(o.total)}
              </p>
              {o.transfer_last5 ? (
                <p className="font-mono text-xs text-blue-700">
                  末五碼 {o.transfer_last5}
                </p>
              ) : (
                <p className="text-xs text-amber-600">後五碼待補</p>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => settle([o.id])}
            >
              已入帳
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
