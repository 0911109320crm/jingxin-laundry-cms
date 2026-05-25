"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  updateService,
  deleteService,
} from "@/app/(admin)/settings/services/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatNTD } from "@/lib/utils";
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABEL } from "./categories";

export type CommissionType = "default" | "percent" | "amount";

export type Service = {
  id: string;
  code: string;
  name: string;
  default_price: number;
  category: string | null;
  sort_order: number;
  active: boolean;
  commission_type: CommissionType;
  commission_value: number;
};

function CommissionDisplay({
  type,
  value,
}: {
  type: CommissionType;
  value: number;
}) {
  if (type === "default") {
    return (
      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
        套用預設
      </span>
    );
  }
  if (type === "percent") {
    return (
      <span className="font-mono text-sm text-emerald-700">{value}%</span>
    );
  }
  return (
    <span className="font-mono text-sm text-emerald-700">
      {formatNTD(value)} / 件
    </span>
  );
}

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
        className={"grid grid-cols-[100px_1fr_90px_120px_160px_56px_60px_auto] items-center gap-2 px-5 py-3"}
      >
        <Input name="code" defaultValue={service.code} required />
        <Input name="name" defaultValue={service.name} required />
        <Input
          name="default_price"
          type="number"
          defaultValue={service.default_price}
        />
        <select
          name="category"
          defaultValue={service.category ?? ""}
          className="h-10 rounded-lg border border-zinc-300 bg-white px-2 text-sm"
        >
          <option value="">— 分類 —</option>
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <Select
            name="commission_type"
            defaultValue={service.commission_type}
            className="w-24"
          >
            <option value="default">預設</option>
            <option value="percent">%</option>
            <option value="amount">$</option>
          </Select>
          <Input
            name="commission_value"
            type="number"
            min={0}
            step="any"
            defaultValue={service.commission_value}
            className="w-16"
          />
        </div>
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
    <div
      className="grid grid-cols-[100px_1fr_90px_120px_160px_56px_60px_auto] items-center gap-2 px-5 py-3 text-sm"
    >
      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono">
        {service.code}
      </code>
      <div className="font-medium text-zinc-900">{service.name}</div>
      <div className="text-zinc-600">{formatNTD(service.default_price)}</div>
      <div className="text-zinc-500 text-xs">
        {service.category
          ? SERVICE_CATEGORY_LABEL[service.category] ?? service.category
          : "—"}
      </div>
      <CommissionDisplay
        type={service.commission_type}
        value={Number(service.commission_value)}
      />
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
