"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updateKpi } from "@/app/(admin)/settings/promotion-types/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function KpiSettingForm({
  currentValue,
  disabled,
}: {
  currentValue: number;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const onSubmit = (fd: FormData) => {
    setSaved(false);
    startTransition(async () => {
      const res = await updateKpi(fd);
      if (!res.ok) alert(res.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <form action={onSubmit} className="flex items-center gap-3">
      <span className="text-sm text-zinc-600">每月目標分數</span>
      <Input
        name="value"
        type="number"
        min={0}
        max={99}
        defaultValue={currentValue}
        className="w-20"
        disabled={disabled}
      />
      <Button type="submit" size="sm" disabled={disabled || pending}>
        <Check className="h-4 w-4" /> 儲存
      </Button>
      {saved && <span className="text-xs text-green-600">✓ 已儲存</span>}
    </form>
  );
}
