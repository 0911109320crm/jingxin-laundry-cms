"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import {
  searchCustomersForPickerAction,
  getCustomerByIdAction,
  type CustomerPickerResult,
} from "@/app/(admin)/customers/actions";

type Props = {
  value: string | null;
  onChange: (id: string | null) => void;
  excludeId?: string;
  placeholder?: string;
};

export function CustomerPicker({
  value,
  onChange,
  excludeId,
  placeholder = "打字搜尋客戶...",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerPickerResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CustomerPickerResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load selected customer info when value changes (first mount or external set)
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    startTransition(async () => {
      const c = await getCustomerByIdAction(value);
      setSelected(c);
    });
  }, [value, selected?.id]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await searchCustomersForPickerAction(query, excludeId);
        setResults(r);
      });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, excludeId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const handlePick = (c: CustomerPickerResult) => {
    setSelected(c);
    onChange(c.id);
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleClear = () => {
    setSelected(null);
    onChange(null);
    setQuery("");
    setResults([]);
  };

  // If a customer is selected, show as a "pill" with × clear button
  if (selected) {
    return (
      <div className="flex h-10 w-full items-center justify-between rounded-lg border border-zinc-300 bg-white px-3 text-sm">
        <span className="truncate">
          <span className="font-medium text-zinc-900">{selected.name}</span>
          <span className="ml-1 text-xs text-zinc-400">{selected.code}</span>
          <span className="ml-2 text-xs text-zinc-500">{selected.phone}</span>
        </span>
        <button
          type="button"
          onClick={handleClear}
          className="ml-2 shrink-0 rounded p-0.5 text-zinc-400 hover:text-rose-600"
          title="清除"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30">
        <Search
          className={`h-4 w-4 shrink-0 text-zinc-400 ${
            isPending ? "animate-pulse" : ""
          }`}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
        />
      </div>

      {open && (query.trim().length >= 1 || results.length > 0) && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {results.length === 0 && !isPending && (
            <p className="px-3 py-2 text-xs text-zinc-400">沒有符合的客戶</p>
          )}
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handlePick(c)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
            >
              <span className="truncate">
                <span className="font-medium text-zinc-900">{c.name}</span>
                <span className="ml-1 text-xs text-zinc-400">{c.code}</span>
              </span>
              <span className="shrink-0 text-xs text-zinc-500">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
