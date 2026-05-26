"use client";

/**
 * Manager PWA 快速搜尋 — 手機版的 Ctrl+K
 *
 * 使用場景：客戶打電話到老闆娘手機 → 老闆娘開擴音 → 一手拿手機
 *   1. 點頭部 🔍 → 全屏 overlay 打開
 *   2. 輸入姓名/電話/地址（任何含 2+ 字元）→ debounce 搜尋
 *   3. 結果卡片：
 *      - 客戶 → 「📝 建單」「📞 撥號」「📋 詳情」3 顆大按鈕
 *      - 訂單 → 整個卡片 tappable，跳到訂單詳情
 *
 * 共用 server action：globalSearchAction（含 legacy_code / item_code 搜尋）
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Phone, Plus, FileText, Users, ClipboardList } from "lucide-react";
import { globalSearchAction, type SearchResults } from "@/app/(admin)/actions/globalSearch";

const STATUS_LABELS: Record<string, string> = {
  pending: "待派工",
  scheduled: "已排案",
  in_progress: "進行中",
  done: "已完成",
  cancelled: "已取消",
};

export function ManagerSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ customers: [], orders: [] });
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults({ customers: [], orders: [] });
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults({ customers: [], orders: [] });
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await globalSearchAction(query);
        setResults(r);
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  const hasResults =
    results.customers.length > 0 || results.orders.length > 0;
  const showEmpty =
    query.trim().length >= 2 && !isPending && !hasResults;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="快速搜尋"
        className="flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 active:bg-brand-100"
      >
        <Search className="h-4 w-4" />
        搜尋
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white"
             style={{ paddingTop: "env(safe-area-inset-top)" }}>
          {/* Search bar sticky top */}
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-200 bg-white px-3 py-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                ref={inputRef}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="姓名／電話／地址／編號"
                className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-zinc-500 active:bg-zinc-100"
              aria-label="關閉"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto"
               style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            {/* Hint */}
            {query.trim().length < 2 && (
              <div className="px-4 py-6 text-center text-sm text-zinc-500">
                輸入 2 個字以上開始搜尋<br />
                <span className="text-xs">可搜：客戶姓名、電話、地址、訂單編號、舊清洗編號</span>
              </div>
            )}

            {/* Loading */}
            {isPending && (
              <div className="px-4 py-3 text-center text-sm text-zinc-400">搜尋中...</div>
            )}

            {/* Empty */}
            {showEmpty && (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                沒找到符合的客戶或訂單
              </div>
            )}

            {/* Customers */}
            {results.customers.length > 0 && (
              <section>
                <p className="flex items-center gap-1.5 border-b border-zinc-100 px-4 py-2 text-xs font-medium text-zinc-500">
                  <Users className="h-3.5 w-3.5" /> 客戶（{results.customers.length}）
                </p>
                <ul className="divide-y divide-zinc-100">
                  {results.customers.map((c) => (
                    <li key={c.id} className="px-4 py-3 space-y-2">
                      <div>
                        <p className="text-base font-medium text-zinc-900">{c.name}</p>
                        <p className="text-sm text-zinc-600 font-mono">{c.phone}</p>
                        <p className="text-xs text-zinc-400">{c.code}</p>
                        {c.matched_address && (
                          <p className="text-xs text-amber-700 mt-0.5">🔍 {c.matched_address}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/orders/new?customer=${c.id}`)}
                          className="flex items-center justify-center gap-1 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-medium text-white active:bg-brand-700"
                        >
                          <Plus className="h-4 w-4" /> 建單
                        </button>
                        <a
                          href={`tel:${c.phone}`}
                          className="flex items-center justify-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 active:bg-zinc-100"
                        >
                          <Phone className="h-4 w-4" /> 撥號
                        </a>
                        <button
                          type="button"
                          onClick={() => navigate(`/customers/${c.id}`)}
                          className="flex items-center justify-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 active:bg-zinc-100"
                        >
                          <FileText className="h-4 w-4" /> 詳情
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Orders */}
            {results.orders.length > 0 && (
              <section>
                <p className="flex items-center gap-1.5 border-b border-t border-zinc-100 px-4 py-2 text-xs font-medium text-zinc-500">
                  <ClipboardList className="h-3.5 w-3.5" /> 訂單（{results.orders.length}）
                </p>
                <ul className="divide-y divide-zinc-100">
                  {results.orders.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/orders/${o.id}`)}
                        className="block w-full px-4 py-3 text-left active:bg-zinc-50"
                      >
                        <p className="text-sm font-mono font-medium text-zinc-900">{o.order_code}</p>
                        <p className="text-sm text-zinc-600">
                          {o.customer_name}
                          {o.scheduled_at && (
                            <> · {new Date(o.scheduled_at).toLocaleDateString("zh-TW")}</>
                          )}
                          {" · "}
                          <span className={
                            o.status === "done" ? "text-green-600"
                              : o.status === "cancelled" ? "text-red-500"
                              : "text-amber-600"
                          }>
                            {STATUS_LABELS[o.status] ?? o.status}
                          </span>
                        </p>
                        {o.matched_hint && (
                          <p className="text-xs text-amber-700 mt-0.5">🔍 {o.matched_hint}</p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
