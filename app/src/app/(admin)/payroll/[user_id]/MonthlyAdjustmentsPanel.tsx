"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Sparkles, X } from "lucide-react";
import {
  addPayrollAdjustment,
  deletePayrollAdjustment,
} from "@/app/(admin)/payroll/adjustment-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatNTD } from "@/lib/utils";
import type { PayrollMonthlyAdj } from "@/lib/payroll";

export function MonthlyAdjustmentsPanel({
  technicianId,
  month,
  adjustments,
  bonusTotal,
  deductionTotal,
  finalized,
}: {
  technicianId: string;
  month: string;
  adjustments: PayrollMonthlyAdj[];
  bonusTotal: number;
  deductionTotal: number;
  finalized: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const net = bonusTotal - deductionTotal;

  const onAdd = (fd: FormData) => {
    fd.set("technician_id", technicianId);
    fd.set("month", month);
    startTransition(async () => {
      const res = await addPayrollAdjustment(fd);
      if (!res.ok) alert(res.error);
      else setAdding(false);
    });
  };

  const onDelete = (id: string, reason: string) => {
    if (!confirm(`刪除「${reason}」？`)) return;
    startTransition(async () => {
      const res = await deletePayrollAdjustment(id);
      if (!res.ok) alert(res.error);
    });
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          月度獎勵 / 扣款
        </CardTitle>
        <div className="flex items-center gap-3">
          <span
            className={`font-mono font-semibold ${
              net >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {net >= 0 ? "+" : ""}
            {formatNTD(net)}
          </span>
          {!finalized && !adding && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-4 w-4" /> 新增
            </Button>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {finalized && (
          <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
            該月已結算鎖定，無法新增 / 刪除月度調整。
          </p>
        )}

        {adding && (
          <form
            action={onAdd}
            className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">新增調整</p>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-[110px_120px_1fr] gap-2">
              <Select name="type" defaultValue="bonus">
                <option value="bonus">獎勵</option>
                <option value="deduction">扣款</option>
              </Select>
              <Input
                name="amount"
                type="number"
                min={1}
                step="any"
                placeholder="金額"
                required
              />
              <Input name="reason" placeholder="原因（必填）" required />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAdding(false)}
              >
                取消
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "儲存中..." : "新增"}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              範例獎勵：滿件獎金、客戶讚美獎、節慶紅包 ｜ 範例扣款：遲到、客訴扣款、物品損壞
            </p>
          </form>
        )}

        {adjustments.length === 0 && !adding ? (
          <p className="text-xs text-zinc-400">本月尚無獎勵 / 扣款紀錄</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {adjustments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="flex flex-1 items-center gap-3">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      a.type === "bonus"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {a.type === "bonus" ? "獎勵" : "扣款"}
                  </span>
                  <span className="text-zinc-700">{a.reason}</span>
                  <span className="text-xs text-zinc-400">
                    {new Date(a.created_at).toLocaleDateString("zh-TW")}
                  </span>
                </div>
                <span
                  className={`font-mono font-semibold ${
                    a.type === "bonus" ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {a.type === "bonus" ? "+" : "-"}
                  {formatNTD(a.amount)}
                </span>
                {!finalized && (
                  <button
                    type="button"
                    onClick={() => onDelete(a.id, a.reason)}
                    disabled={pending}
                    className="text-rose-500 hover:text-rose-700"
                    title="刪除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
