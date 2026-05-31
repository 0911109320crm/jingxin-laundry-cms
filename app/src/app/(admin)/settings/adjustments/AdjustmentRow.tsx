"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  updateAdjustment,
  deleteAdjustment,
} from "@/app/(admin)/settings/adjustments/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatNTD } from "@/lib/utils";

export type Adjustment = {
  id: string;
  name: string;
  type: "discount" | "addon";
  default_amount: number;
  active: boolean;
  affects_commission: boolean;
};

export function AdjustmentRow({ adjustment }: { adjustment: Adjustment }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const onSave = (fd: FormData) => {
    startTransition(async () => {
      const res = await updateAdjustment(adjustment.id, fd);
      if (!res.ok) alert(res.error);
      else setEditing(false);
    });
  };

  const onDelete = () => {
    if (!confirm(`刪除「${adjustment.name}」？`)) return;
    startTransition(async () => {
      const res = await deleteAdjustment(adjustment.id);
      if (!res.ok) alert(res.error);
    });
  };

  if (editing) {
    return (
      <form
        action={onSave}
        className="grid grid-cols-1 md:grid-cols-[1fr_110px_110px_110px_70px_auto] md:items-center gap-2 px-5 py-3"
      >
        <Input name="name" defaultValue={adjustment.name} required />
        <Select name="type" defaultValue={adjustment.type}>
          <option value="addon">加價</option>
          <option value="discount">折扣</option>
        </Select>
        <Input
          name="default_amount"
          type="number"
          defaultValue={adjustment.default_amount}
        />
        <label className="flex items-center gap-1.5 text-xs text-zinc-600">
          <input
            type="checkbox"
            name="affects_commission"
            defaultChecked={adjustment.affects_commission}
            className="h-4 w-4"
          />
          進薪資
        </label>
        <label className="flex items-center gap-1 text-sm text-zinc-600">
          <input
            type="checkbox"
            name="active"
            defaultChecked={adjustment.active}
            className="h-4 w-4"
          />
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
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_110px_110px_110px_70px_auto] md:items-center gap-2 px-5 py-3 text-sm">
      <div className="font-medium text-zinc-900">{adjustment.name}</div>
      <div>
        {adjustment.type === "addon" ? (
          <span className="rounded bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
            加價
          </span>
        ) : (
          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
            折扣
          </span>
        )}
      </div>
      <div className="text-zinc-600">
        {formatNTD(adjustment.default_amount)}
      </div>
      <div>
        {adjustment.affects_commission ? (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
            ✓ 進薪資
          </span>
        ) : (
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
            不進薪資
          </span>
        )}
      </div>
      <div>
        {adjustment.active ? (
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
