"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRightLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatNTD } from "@/lib/utils";
import { swapOrderItemServiceAction } from "./service-actions";
import {
  SERVICE_CATEGORY_LABEL as CATEGORY_LABEL,
  SERVICE_CATEGORY_ORDER,
} from "@/app/(admin)/settings/services/categories";

type ServiceOption = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  default_price: number;
};

type Props = {
  orderId: string;
  orderItemId: string;
  currentServiceId: string | null;
  currentServiceCategory: string | null;
  currentQuantity: number;
  /** 全部 active service_items（含非 basic_choice） */
  services: ServiceOption[];
};

export function ServiceItemSwapper({
  orderId,
  orderItemId,
  currentServiceId,
  currentServiceCategory,
  services,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string>(currentServiceId ?? "");
  const [filterCat, setFilterCat] = useState<string>(currentServiceCategory ?? "");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) if (s.category) set.add(s.category);
    const rank = (k: string) => {
      const i = SERVICE_CATEGORY_ORDER.indexOf(k);
      return i === -1 ? SERVICE_CATEGORY_ORDER.length : i;
    };
    return [...set].sort((a, b) => rank(a) - rank(b));
  }, [services]);

  const visible = useMemo(() => {
    if (!filterCat) return services;
    return services.filter((s) => s.category === filterCat);
  }, [services, filterCat]);

  const selected = services.find((s) => s.id === selectedId);
  const previewTotal = selected ? Number(selected.default_price) : 0;

  const start = () => {
    setSelectedId(currentServiceId ?? "");
    setFilterCat(currentServiceCategory ?? "");
    setOpen(true);
  };

  const save = () => {
    if (!selectedId) {
      alert("請選擇實際品項");
      return;
    }
    startTransition(async () => {
      const res = await swapOrderItemServiceAction({
        order_id: orderId,
        order_item_id: orderItemId,
        service_item_id: selectedId,
        quantity: 1,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={start}
        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
      >
        <ArrowRightLeft className="h-3 w-3" /> 換成實際品項
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-brand-200 bg-brand-50/30 p-2 text-xs">
      <p className="font-medium text-brand-800">換成實際品項</p>

      {categories.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setFilterCat("")}
            className={`rounded px-2 py-0.5 ${
              filterCat === ""
                ? "bg-brand-600 text-white"
                : "bg-white border border-zinc-300 text-zinc-600"
            }`}
          >
            全部
          </button>
          {categories.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setFilterCat(c)}
              className={`rounded px-2 py-0.5 ${
                filterCat === c
                  ? "bg-brand-600 text-white"
                  : "bg-white border border-zinc-300 text-zinc-600"
              }`}
            >
              {CATEGORY_LABEL[c] ?? c}
            </button>
          ))}
        </div>
      )}

      <div>
        <p className="mb-1 text-zinc-600">服務項目</p>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="">— 選擇實際品項 —</option>
          {visible.map((s) => (
            <option key={s.id} value={s.id}>
              {/* SKU code 是內部代號，師傅只看中文品名 + 價格 */}
              {s.name}（{formatNTD(s.default_price)}）
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between rounded border border-zinc-200 bg-white px-2 py-1.5">
        <span className="text-zinc-600">金額</span>
        <span className="text-sm font-mono font-bold text-brand-700">
          {formatNTD(previewTotal)}
        </span>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          <X className="h-3.5 w-3.5" /> 取消
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={pending}>
          <Check className="h-3.5 w-3.5" /> {pending ? "儲存中..." : "套用"}
        </Button>
      </div>
    </div>
  );
}
