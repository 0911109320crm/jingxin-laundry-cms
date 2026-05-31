"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  updateBrand,
  deleteBrand,
  reorderBrand,
} from "@/app/(admin)/settings/machine-brands/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type Brand = {
  id: string;
  category: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export function BrandRow({
  brand,
  position,
  total,
}: {
  brand: Brand;
  position: number;
  total: number;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [posInput, setPosInput] = useState(String(position));

  const onSave = (fd: FormData) => {
    startTransition(async () => {
      const res = await updateBrand(brand.id, fd);
      if (!res.ok) alert(res.error);
      else setEditing(false);
    });
  };

  const commitOrder = () => {
    const n = parseInt(posInput, 10);
    if (!Number.isFinite(n) || n === position) {
      setPosInput(String(position)); // 無效或沒變 → 還原顯示
      return;
    }
    startTransition(async () => {
      const res = await reorderBrand(brand.id, n);
      if (!res.ok) {
        alert(res.error);
        setPosInput(String(position));
      }
    });
  };

  const onDelete = () => {
    if (!confirm(`刪除「${brand.name}」？`)) return;
    startTransition(async () => {
      const res = await deleteBrand(brand.id);
      if (!res.ok) alert(res.error);
    });
  };

  if (editing) {
    return (
      <form
        action={onSave}
        className="flex items-center gap-2 rounded-lg border border-brand-300 bg-white p-2"
      >
        <Input name="name" defaultValue={brand.name} required className="flex-1" />
        <label className="flex shrink-0 items-center gap-1 text-xs text-zinc-600">
          <input
            type="checkbox"
            name="active"
            defaultChecked={brand.active}
            className="h-4 w-4"
          />
          啟用
        </label>
        <div className="flex shrink-0 gap-1">
          <Button type="submit" size="sm" disabled={pending}>
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
            disabled={pending}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="group flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2.5 hover:border-zinc-300">
      {/* 順序：直接輸入數字（按 Enter 或點別處生效） */}
      <input
        type="number"
        min={1}
        max={total}
        value={posInput}
        disabled={pending}
        onChange={(e) => setPosInput(e.target.value)}
        onBlur={commitOrder}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        title="輸入顯示順序"
        aria-label="顯示順序"
        className="w-12 shrink-0 rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-center text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50"
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
        {brand.name}
      </span>
      {!brand.active && (
        <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          停用
        </span>
      )}
      <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={pending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
