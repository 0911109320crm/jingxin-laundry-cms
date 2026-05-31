"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  updatePromotionType,
  deletePromotionType,
} from "@/app/(admin)/settings/promotion-types/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type PromotionType = {
  id: string;
  code: string;
  label: string;
  points: number;
  sort_order: number;
  active: boolean;
};

export function PromotionTypeRow({ promo }: { promo: PromotionType }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const onSave = (fd: FormData) => {
    startTransition(async () => {
      const res = await updatePromotionType(promo.id, fd);
      if (!res.ok) alert(res.error);
      else setEditing(false);
    });
  };

  const onDelete = () => {
    if (!confirm(`刪除「${promo.label}」？舊紀錄會保留但新訂單無法再選此項`)) return;
    startTransition(async () => {
      const res = await deletePromotionType(promo.id);
      if (!res.ok) alert(res.error);
    });
  };

  if (editing) {
    return (
      <form
        action={onSave}
        className="grid grid-cols-1 md:grid-cols-[160px_1fr_70px_70px_80px_auto] md:items-center gap-2 px-5 py-3"
      >
        <Input value={promo.code} disabled className="text-zinc-500" />
        <Input name="label" defaultValue={promo.label} required />
        <Input
          name="points"
          type="number"
          min={0}
          defaultValue={promo.points}
        />
        <Input
          name="sort_order"
          type="number"
          defaultValue={promo.sort_order}
        />
        <label className="flex items-center gap-1 text-sm text-zinc-600">
          <input
            type="checkbox"
            name="active"
            defaultChecked={promo.active}
            className="h-4 w-4"
          />
          啟用
        </label>
        <div className="flex gap-1">
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
    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_70px_70px_80px_auto] md:items-center gap-2 px-5 py-3">
      <div className="text-xs font-mono text-zinc-400">{promo.code}</div>
      <div className="text-sm font-medium text-zinc-900">{promo.label}</div>
      <div className="rounded bg-amber-50 text-center text-sm font-bold text-amber-700">
        +{promo.points}
      </div>
      <div className="text-sm text-zinc-500">排序 {promo.sort_order}</div>
      <div>
        {promo.active ? (
          <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700">
            啟用
          </span>
        ) : (
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
            停用
          </span>
        )}
      </div>
      <div className="flex gap-1">
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
