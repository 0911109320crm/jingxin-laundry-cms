"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, ClipboardList, X, Phone, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  quickSearchAction,
  globalSearchAction,
  type SearchResults,
  type CustomerResult,
} from "@/app/(admin)/actions/globalSearch";

const STATUS_LABELS: Record<string, string> = {
  pending: "待排程",
  scheduled: "已排程",
  in_progress: "進行中",
  done: "已完成",
  cancelled: "已取消",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // 上段：快速搜尋（電話 / 地址）即時
  const [quickQuery, setQuickQuery] = useState("");
  const [quickResults, setQuickResults] = useState<CustomerResult[]>([]);
  const [quickPending, startQuick] = useTransition();
  const quickRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 下段：完整搜尋（姓名/編號/訂單/機器/保固單）按 Enter
  const [fullQuery, setFullQuery] = useState("");
  const [fullResults, setFullResults] = useState<SearchResults>({
    customers: [],
    orders: [],
  });
  const [fullPending, startFull] = useTransition();
  const [fullSearched, setFullSearched] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-global-search", handler);
    return () => window.removeEventListener("open-global-search", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => quickRef.current?.focus(), 50);
    } else {
      setQuickQuery("");
      setQuickResults([]);
      setFullQuery("");
      setFullResults({ customers: [], orders: [] });
      setFullSearched("");
    }
  }, [open]);

  // 快速搜尋：debounce 即時
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (quickQuery.trim().length < 2) {
      setQuickResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startQuick(async () => {
        setQuickResults(await quickSearchAction(quickQuery));
      });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [quickQuery]);

  const runFullSearch = () => {
    const q = fullQuery.trim();
    if (q.length < 2) return;
    setFullSearched(q);
    startFull(async () => {
      setFullResults(await globalSearchAction(q));
    });
  };

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  // 查無客戶 → 直接去建立，帶入已輸入的電話/地址（純數字當電話、否則當地址）
  function goCreateFromQuick(q: string) {
    const t = q.trim();
    const digits = t.replace(/\D/g, "");
    const param =
      digits.length >= 6 && digits.length / t.length > 0.6
        ? `phone=${encodeURIComponent(t)}`
        : `address=${encodeURIComponent(t)}`;
    navigate(`/customers/new?${param}`);
  }

  if (!open) return null;

  const CustomerRow = (c: CustomerResult) => (
    <button
      key={c.id}
      type="button"
      onClick={() => navigate(`/customers/${c.id}`)}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 transition-colors"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
        {c.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">{c.name}</p>
        <p className="truncate text-xs text-zinc-500">
          {c.phone} · {c.code}
        </p>
        {c.matched_address && (
          <p className="truncate text-xs text-brand-700">📍 {c.matched_address}</p>
        )}
      </div>
    </button>
  );

  const quickEmpty =
    quickQuery.trim().length >= 2 && !quickPending && quickResults.length === 0;
  const fullHasResults =
    fullResults.customers.length > 0 || fullResults.orders.length > 0;
  const fullEmpty =
    fullSearched.length >= 2 && !fullPending && !fullHasResults;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[8vh]"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/40" />

      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 上段：快速搜尋（電話 / 地址）── */}
        <div className="border-b border-zinc-200">
          <div className="flex items-center gap-2 px-4 pt-3">
            <Phone className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-zinc-600">
              快速搜尋（電話 / 地址）
            </span>
            <span className="hidden text-[11px] text-zinc-400 sm:inline">
              邊打邊找 · 例：0912345678、員林、建國路
            </span>
            {/* 手機沒有 ESC，給可見的關閉鈕，避免老闆娘離不開 */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="關閉搜尋"
              className="ml-auto rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <Search
              className={cn(
                "h-4 w-4 shrink-0 text-zinc-400",
                quickPending && "animate-pulse",
              )}
            />
            <input
              ref={quickRef}
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="輸入電話或地址…"
              className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
            {quickQuery && (
              <button
                type="button"
                onClick={() => setQuickQuery("")}
                className="rounded p-0.5 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {(quickResults.length > 0 || quickEmpty) && (
            <div className="max-h-52 overflow-y-auto pb-1">
              {quickResults.map((c) => CustomerRow(c))}
              {quickEmpty && (
                <div className="px-4 py-3 text-center">
                  <p className="text-xs text-zinc-400">
                    查無電話 / 地址符合「{quickQuery}」
                  </p>
                  <button
                    type="button"
                    onClick={() => goCreateFromQuick(quickQuery)}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    ＋ 用「{quickQuery}」建立新客戶
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 下段：完整搜尋（按 Enter）── */}
        <div>
          <div className="flex items-center gap-2 px-4 pt-3">
            <ListFilter className="h-3.5 w-3.5 text-brand-500" />
            <span className="text-xs font-semibold text-zinc-600">
              完整搜尋（姓名 / 編號 / 訂單 / 機器 / 保固單）
            </span>
            <span className="text-[11px] text-zinc-400">打完按 Enter</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <ListFilter
              className={cn(
                "h-4 w-4 shrink-0 text-zinc-400",
                fullPending && "animate-pulse",
              )}
            />
            <input
              value={fullQuery}
              onChange={(e) => setFullQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runFullSearch();
                }
              }}
              placeholder="輸入後按 Enter 搜尋…"
              className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={runFullSearch}
              disabled={fullQuery.trim().length < 2 || fullPending}
              className="shrink-0 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40"
            >
              搜尋
            </button>
          </div>

          {(fullHasResults || fullEmpty || fullPending) && (
            <div className="max-h-72 overflow-y-auto py-1">
              {fullPending && (
                <p className="px-4 py-3 text-center text-xs text-zinc-400">
                  搜尋中…
                </p>
              )}
              {fullResults.customers.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <Users className="h-3 w-3 text-zinc-400" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      顧客
                    </span>
                  </div>
                  {fullResults.customers.map((c) => CustomerRow(c))}
                </section>
              )}
              {fullResults.orders.length > 0 && (
                <section
                  className={
                    fullResults.customers.length > 0
                      ? "mt-1 border-t border-zinc-100 pt-1"
                      : ""
                  }
                >
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <ClipboardList className="h-3 w-3 text-zinc-400" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      訂單
                    </span>
                  </div>
                  {fullResults.orders.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => navigate(`/orders/${o.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 transition-colors"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                        <ClipboardList className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {o.order_code}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {o.customer_name}
                          {o.scheduled_at && (
                            <>
                              {" · "}
                              {new Date(o.scheduled_at).toLocaleDateString("zh-TW")}
                            </>
                          )}
                          {" · "}
                          <span
                            className={
                              o.status === "done"
                                ? "text-green-600"
                                : o.status === "cancelled"
                                  ? "text-red-500"
                                  : "text-amber-600"
                            }
                          >
                            {STATUS_LABELS[o.status] ?? o.status}
                          </span>
                        </p>
                        {o.matched_hint && (
                          <p className="mt-0.5 truncate text-xs text-amber-700">
                            🔍 {o.matched_hint}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </section>
              )}
              {fullEmpty && (
                <div className="px-4 py-3 text-center">
                  <p className="text-xs text-zinc-400">
                    找不到「{fullSearched}」的相關結果
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/customers/new?name=${encodeURIComponent(fullSearched)}`,
                      )
                    }
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    ＋ 用「{fullSearched}」建立新客戶
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-400">
          <span>上：電話/地址即時找　·　下：其他欄位按 Enter</span>
          <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5">
            ESC 關閉
          </kbd>
        </div>
      </div>
    </div>
  );
}
