"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import {
  updateBrand,
  deleteBrand,
  moveBrand,
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
  isFirst,
  isLast,
}: {
  brand: Brand;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const onSave = (fd: FormData) => {
    startTransition(async () => {
      const res = await updateBrand(brand.id, fd);
      if (!res.ok) alert(res.error);
      else setEditing(false);
    });
  };

  const onMove = (direction: "up" | "down") => {
    startTransition(async () => {
      const res = await moveBrand(brand.id, direction);
      if (!res.ok) alert(res.error);
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
      {/* 順序調整 ↑↓ */}
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={() => onMove("up")}
          disabled={pending || isFirst}
          title="上移"
          className="rounded p-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-25 disabled:hover:bg-transparent"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove("down")}
          disabled={pending || isLast}
          title="下移"
          className="rounded p-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-25 disabled:hover:bg-transparent"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
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
