"use client";

import { useEffect, useRef, useState } from "react";
import { Search, MapPin } from "lucide-react";

export type AddrOption = {
  id: string;
  county: string;
  district: string;
  address: string;
  label: string | null;
  is_default: boolean;
};

function fullLabel(a: AddrOption): string {
  return `${a.county}${a.district}${a.address}${a.label ? `（${a.label}）` : ""}`;
}

/**
 * 服務地址搜尋選擇器（資料為該客戶已載入的地址，前端即時過濾）。
 * 聚焦時直接列出全部地址；打字可過濾；選定後顯示地址＋「變更」。
 */
export function AddressPicker({
  addresses,
  value,
  onChange,
  disabled,
}: {
  addresses: AddrOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = addresses.find((a) => a.id === value) ?? null;

  if (disabled || addresses.length === 0) {
    return (
      <div className="flex h-10 w-full items-center rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-400">
        — 先選客戶 —
      </div>
    );
  }

  if (selected && !open) {
    return (
      <div className="flex h-10 w-full items-center justify-between rounded-lg border border-zinc-300 bg-white px-3 text-sm">
        <span className="flex min-w-0 items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="truncate text-zinc-900">{fullLabel(selected)}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setQuery("");
          }}
          className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-xs text-brand-700 hover:bg-brand-50"
        >
          變更
        </button>
      </div>
    );
  }

  const q = query.trim();
  const results = q
    ? addresses.filter((a) => fullLabel(a).includes(q))
    : addresses;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30">
        <Search className="h-4 w-4 shrink-0 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="搜尋或選擇地址…"
          className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          autoFocus={open && !selected ? false : undefined}
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-400">沒有符合的地址</p>
          ) : (
            results.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onChange(a.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={`flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm hover:bg-zinc-50 ${
                  a.id === value ? "bg-brand-50/50" : ""
                }`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span className="min-w-0 flex-1 truncate text-zinc-800">
                  {fullLabel(a)}
                </span>
                {a.is_default && (
                  <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700">
                    預設
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
