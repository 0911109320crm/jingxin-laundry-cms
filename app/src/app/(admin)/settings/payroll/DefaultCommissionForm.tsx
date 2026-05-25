"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updateDefaultCommission } from "./actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export function DefaultCommissionForm({
  defaultType,
  defaultValue,
}: {
  defaultType: "percent" | "amount";
  defaultValue: number;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const onSubmit = (fd: FormData) => {
    setSaved(false);
    startTransition(async () => {
      const res = await updateDefaultCommission(fd);
      if (!res.ok) alert(res.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <form action={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">抽成方式</span>
        <Select
          name="default_commission_type"
          defaultValue={defaultType}
          className="w-32"
        >
          <option value="percent">百分比 (%)</option>
          <option value="amount">固定金額 / 件</option>
        </Select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">數值</span>
        <Input
          name="default_commission_value"
          type="number"
          min={0}
          step="any"
          defaultValue={defaultValue}
          className="w-28"
        />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        <Check className="h-4 w-4" /> 儲存
      </Button>
      {saved && <span className="text-xs text-green-600">✓ 已儲存</span>}
    </form>
  );
}
