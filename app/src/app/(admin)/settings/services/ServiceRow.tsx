"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  updateService,
  deleteService,
} from "@/app/(admin)/settings/services/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatNTD } from "@/lib/utils";

export type Service = {
  id: string;
  code: string;
  name: string;
  default_price: number;
  category: string | null;
  sort_order: number;
  active: boolean;
};

const CATEGORY_LABEL: Record<string, string> = {
  washing_machine: "洗衣機",
  air_conditioner: "冷氣",
  mattress: "床墊",
  sofa: "沙發",
  other: "其他",
};

export function ServiceRow({ service }: { service: Service }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const onSave = (fd: FormData) => {
    startTransition(async () => {
      const res = await updateService(service.id, fd);
      if (!res.ok) alert(res.error);
      else setEditing(false);
    });
  };

  const onDelete = () => {
    if (!confirm(`刪除「${service.name}」？`)) return;
    startTransition(async () => {
      const res = await deleteService(service.id);
      if (!res.ok) alert(res.error);
    });
  };

  if (editing) {
    return (
      <form
        action={onSave}
        className="grid grid-cols-[80px_1fr_100px_120px_80px_70px_auto] items-center gap-2 px-5 py-3"
      >
        <Input name="code" defaultValue={service.code} required />
        <Input name="name" defaultValue={service.name} required />
        <Input
          name="default_price"
          type="number"
          defaultValue={service.default_price}
        />
        <Input
          name="category"
          defaultValue={service.category ?? ""}
          placeholder="分類"
        />
        <Input
          name="sort_order"
          type="number"
          defaultValue={service.sort_order}
        />
        <label className="flex items-center gap-1 text-sm text-zinc-600">
          <input
            type="checkbox"
            name="active"
            defaultChecked={service.active}
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
    <div className="grid grid-cols-[80px_1fr_100px_120px_80px_70px_auto] items-center gap-2 px-5 py-3 text-sm">
      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono">
        {service.code}
      </code>
      <div className="font-medium text-zinc-900">{service.name}</div>
      <div className="text-zinc-600">{formatNTD(service.default_price)}</div>
      <div className="text-zinc-500 text-xs">
        {service.category
          ? CATEGORY_LABEL[service.category] ?? service.category
          : "—"}
      </div>
      <div className="text-zinc-400 text-xs">#{service.sort_order}</div>
      <div>
        {service.active ? (
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
