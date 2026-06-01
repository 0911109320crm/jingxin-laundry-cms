"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, GitMerge, X } from "lucide-react";
import { mergeAddressesAction } from "@/app/(admin)/customers/actions";

export type AddrItem = {
  id: string;
  county: string;
  district: string;
  address: string;
  label: string | null;
  is_default: boolean;
  orderCount: number;
  machineCount: number;
};

function fullLabel(a: AddrItem) {
  return `${a.county}${a.district} ${a.address}${a.label ? `（${a.label}）` : ""}`;
}

/** 建議保留：訂單最多 → 平手取地址字串最長(最完整) */
function suggestKeep(items: AddrItem[]): string | null {
  if (items.length === 0) return null;
  return [...items].sort(
    (a, b) =>
      b.orderCount - a.orderCount ||
      b.address.length - a.address.length,
  )[0].id;
}

export function CustomerAddresses({
  customerId,
  addresses,
  readonly = false,
}: {
  customerId: string;
  addresses: AddrItem[];
  readonly?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [keepId, setKeepId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const selectable = !readonly && addresses.length > 1;
  const globalSuggest = useMemo(() => suggestKeep(addresses), [addresses]);

  const selectedItems = addresses.filter((a) => selected.has(a.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function openConfirm() {
    setKeepId(suggestKeep(selectedItems) ?? selectedItems[0]?.id ?? "");
    setConfirmOpen(true);
  }

  function doMerge() {
    const mergeIds = selectedItems.map((a) => a.id).filter((i) => i !== keepId);
    if (!keepId || mergeIds.length === 0) return;
    startTransition(async () => {
      const res = await mergeAddressesAction(customerId, keepId, mergeIds);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setConfirmOpen(false);
      setSelected(new Set());
      router.refresh();
    });
  }

  if (addresses.length === 0) {
    return <p className="text-sm text-zinc-500">尚無地址</p>;
  }

  const movedOrders = selectedItems
    .filter((a) => a.id !== keepId)
    .reduce((s, a) => s + a.orderCount, 0);

  return (
    <div className="space-y-2">
      {selected.size === 0 && selectable && (
        <p className="text-xs text-zinc-400">
          勾選「其實是同一個地方」的地址即可合併（修正舊資料的重複地址）
        </p>
      )}
      {addresses.map((a) => {
        const checked = selected.has(a.id);
        return (
          <label
            key={a.id}
            className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm ${
              checked ? "border-brand-400 bg-brand-50" : "border-zinc-200"
            } ${selectable ? "cursor-pointer" : ""}`}
          >
            {selectable && (
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(a.id)}
                className="mt-1 h-4 w-4 shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span className="font-medium text-zinc-900">
                  {a.county} {a.district}
                </span>
                {a.is_default && (
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">預設</span>
                )}
                {a.id === globalSuggest && addresses.length > 1 && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">建議保留</span>
                )}
              </div>
              <p className="mt-0.5 text-zinc-700">{a.address}{a.label ? `（${a.label}）` : ""}</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                📋 訂單 {a.orderCount}　·　🔧 機器 {a.machineCount}
              </p>
            </div>
          </label>
        );
      })}

      {/* 浮動合併列 */}
      {selectable && selected.size >= 2 && (
        <div className="sticky bottom-2 z-10 flex items-center justify-between gap-2 rounded-lg border border-brand-300 bg-white p-2 shadow-lg">
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
          >
            清除
          </button>
          <button
            type="button"
            onClick={openConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <GitMerge className="h-4 w-4" /> 合併所選 ({selected.size})
          </button>
        </div>
      )}

      {/* 確認視窗 */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => !pending && setConfirmOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900">合併地址</h2>
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={pending}>
                <X className="h-5 w-5 text-zinc-400" />
              </button>
            </div>
            <p className="mt-1 text-sm text-zinc-500">選一筆「要保留」的地址，其餘併入它：</p>

            <div className="mt-3 space-y-2">
              {selectedItems.map((a) => (
                <label
                  key={a.id}
                  className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm ${
                    keepId === a.id ? "border-emerald-400 bg-emerald-50" : "border-zinc-200"
                  } cursor-pointer`}
                >
                  <input
                    type="radio"
                    name="keep"
                    checked={keepId === a.id}
                    onChange={() => setKeepId(a.id)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-800">{fullLabel(a)}</p>
                    <p className="text-xs text-zinc-400">📋 訂單 {a.orderCount} · 🔧 機器 {a.machineCount}</p>
                    {keepId === a.id && (
                      <span className="text-xs font-medium text-emerald-700">← 保留這筆</span>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              共 <b>{selectedItems.length - 1}</b> 筆地址會併入保留地址並隱藏（可復原），
              其下 <b>{movedOrders}</b> 筆訂單會自動改到保留地址。歷史訂單不會消失。
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
                className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={doMerge}
                disabled={pending || !keepId}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {pending ? "合併中…" : `合併並刪除 (${selectedItems.length - 1}筆)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
