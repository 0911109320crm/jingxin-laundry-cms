"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updatePayrollConstants } from "./actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type PayrollConstantsProps = {
  base_salary: number;
  base_units: number;
  overage_unit_rate: number;
  undismantled_bonus: number;
  full_attendance_bonus: number;
  meal_base: number;
  meal_per_day: number;
  marketing_threshold: number;
  marketing_per_point: number;
};

const FIELDS: {
  name: keyof PayrollConstantsProps;
  label: string;
  hint: string;
}[] = [
  { name: "base_salary", label: "本薪", hint: "固定月薪，未達基本台數仍領滿" },
  { name: "base_units", label: "基本台數", hint: "本薪內含的台數" },
  { name: "overage_unit_rate", label: "超額每台獎金", hint: "超過基本台數後每台" },
  { name: "undismantled_bonus", label: "未拆解每台加給", hint: "師傅勾「未拆解」的機器" },
  { name: "full_attendance_bonus", label: "全勤獎金", hint: "當月無休假登記" },
  { name: "meal_base", label: "伙食津貼（固定）", hint: "每月固定發" },
  { name: "meal_per_day", label: "伙食津貼（每出勤日）", hint: "出勤日數 × 此金額" },
  { name: "marketing_threshold", label: "行銷獎金門檻（分）", hint: "打卡積分超過此分數才開始算" },
  { name: "marketing_per_point", label: "行銷獎金（每分）", hint: "超過門檻後每 1 分" },
];

export function PayrollConstantsForm({
  constants,
}: {
  constants: PayrollConstantsProps;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const onSubmit = (fd: FormData) => {
    setSaved(false);
    startTransition(async () => {
      const res = await updatePayrollConstants(fd);
      if (!res.ok) alert(res.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((f) => (
          <label key={f.name} className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">{f.label}</span>
            <Input
              name={f.name}
              type="number"
              min={0}
              step="any"
              defaultValue={constants[f.name]}
              required
            />
            <span className="text-xs text-zinc-400">{f.hint}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Check className="h-4 w-4" /> 儲存
        </Button>
        {saved && <span className="text-xs text-green-600">✓ 已儲存</span>}
        <span className="text-xs text-zinc-400">
          改完即時生效於「未結算」月份，已結算月份不受影響。
        </span>
      </div>
    </form>
  );
}
