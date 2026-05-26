"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, ClipboardList, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { globalSearchAction, type SearchResults } from "@/app/(admin)/actions/globalSearch";

const STATUS_LABELS: Record<string, string> = {
  pending: "待排程",
  scheduled: "已排程",
  in_progress: "進行中",
  done: "已完成",
  cancelled: "已取消",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ customers: [], orders: [] });
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Keyboard shortcut: Cmd+K / Ctrl+K to open, Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Listen for custom event from Sidebar chip
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-global-search", handler);
    return () => window.removeEventListener("open-global-search", handler);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults({ customers: [], orders: [] });
    }
  }, [open]);

  // Debounced search
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal card */}
      <div
        className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3">
          <Search className={cn("h-4 w-4 shrink-0 text-zinc-400", isPending && "animate-pulse")} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋姓名、電話、編號、地址、訂單…"
            className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded p-0.5 text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden shrink-0 rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 sm:block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {hasResults && (
          <div className="max-h-80 overflow-y-auto py-2">
            {results.customers.length > 0 && (
              <section>
                <div className="flex items-center gap-2 px-4 py-1.5">
                  <Users className="h-3 w-3 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">顧客</span>
                </div>
                {results.customers.map((c) => (
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
                      <p className="text-sm font-medium text-zinc-900 truncate">{c.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{c.phone} · {c.code}</p>
                      {c.matched_address && (
                        <p className="text-xs text-brand-700 truncate">
                          📍 {c.matched_address}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </section>
            )}

            {results.orders.length > 0 && (
              <section className={results.customers.length > 0 ? "mt-1 border-t border-zinc-100 pt-1" : ""}>
                <div className="flex items-center gap-2 px-4 py-1.5">
                  <ClipboardList className="h-3 w-3 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">訂單</span>
                </div>
                {results.orders.map((o) => (
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
                      <p className="text-sm font-medium text-zinc-900 truncate">{o.order_code}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {o.customer_name}
                        {o.scheduled_at && (
                          <> · {new Date(o.scheduled_at).toLocaleDateString("zh-TW")}</>
                        )}
                        {" · "}
                        <span className={o.status === "done" ? "text-green-600" : o.status === "cancelled" ? "text-red-500" : "text-amber-600"}>
                          {STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </p>
                      {o.matched_hint && (
                        <p className="text-xs text-amber-700 mt-0.5 truncate">
                          🔍 {o.matched_hint}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </section>
            )}
          </div>
        )}

        {/* Empty state */}
        {showEmpty && (
          <div className="py-10 text-center text-sm text-zinc-400">
            找不到「{query}」的相關結果
          </div>
        )}

        {/* Hint when no query */}
        {query.trim().length < 2 && !isPending && (
          <div className="px-4 py-5 text-center text-xs text-zinc-400">
            輸入至少 2 個字（姓名 / 電話 / 編號 / 地址 / 訂單）
          </div>
        )}
      </div>
    </div>
  );
}
