"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  updateSource,
  deleteSource,
} from "@/app/(admin)/settings/sources/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type Source = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export function SourceRow({ source }: { source: Source }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const onSave = (fd: FormData) => {
    startTransition(async () => {
      const res = await updateSource(source.id, fd);
      if (!res.ok) alert(res.error);
      else setEditing(false);
    });
  };

  const onDelete = () => {
    if (!confirm(`刪除「${source.name}」？`)) return;
    startTransition(async () => {
      const res = await deleteSource(source.id);
      if (!res.ok) alert(res.error);
    });
  };

  if (editing) {
    return (
      <form
        action={onSave}
        className="grid grid-cols-[1fr_100px_80px_auto] items-center gap-2 px-5 py-3"
      >
        <Input name="name" defaultValue={source.name} required />
        <Input
          name="sort_order"
          type="number"
          defaultValue={source.sort_order}
        />
        <label className="flex items-center gap-1 text-sm text-zinc-600">
          <input
            type="checkbox"
            name="active"
            defaultChecked={source.active}
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
    <div className="grid grid-cols-[1fr_100px_80px_auto] items-center gap-2 px-5 py-3">
      <div className="text-sm font-medium text-zinc-900">{source.name}</div>
      <div className="text-sm text-zinc-500">排序 {source.sort_order}</div>
      <div>
        {source.active ? (
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
