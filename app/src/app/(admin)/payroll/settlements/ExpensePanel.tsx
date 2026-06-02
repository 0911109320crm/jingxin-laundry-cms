"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Fuel, Check } from "lucide-react";
import {
  addTechnicianExpenseAction,
  removeTechnicianExpenseAction,
  setExpenseReimbursedAction,
} from "./expense-actions";
import { formatNTD } from "@/lib/utils";

export type ExpenseLite = {
  id: string;
  name: string;
  amount: number;
  expense_date: string;
};

/**
 * 待回繳卡片底部：師傅代墊支出登記 + 「收款 − 代墊 = 預計繳回現金」對帳。
 * 只顯示未沖銷的支出（已沖銷代表老闆娘已用回繳現金抵掉）。
 */
export function ExpensePanel({
  technicianId,
  technicianName,
  cashTotal,
  initialExpenses,
}: {
  technicianId: string;
  technicianName: string;
  cashTotal: number;
  initialExpenses: ExpenseLite[];
}) {
  const [expenses, setExpenses] = useState<ExpenseLite[]>(initialExpenses);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();

  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const expectedCash = cashTotal - expenseTotal;

  const add = () => {
    const trimmed = name.trim();
    const amt = parseInt(amount, 10);
    if (!trimmed) {
      alert("請填支出項目名稱");
      return;
    }
    if (isNaN(amt) || amt < 0) {
      alert("請填正確金額");
      return;
    }
    startTransition(async () => {
      const res = await addTechnicianExpenseAction(technicianId, trimmed, amt);
      if (!res.ok) {
        alert(res.error ?? "新增失敗");
        return;
      }
      setExpenses((prev) => [
        ...prev,
        {
          id: res.realId!,
          name: trimmed,
          amount: amt,
          expense_date: new Date().toISOString().slice(0, 10),
        },
      ]);
      setName("");
      setAmount("");
    });
  };

  const remove = (id: string) => {
    const prev = expenses;
    setExpenses((p) => p.filter((e) => e.id !== id));
    startTransition(async () => {
      const res = await removeTechnicianExpenseAction(id);
      if (!res.ok) {
        alert(res.error ?? "刪除失敗");
        setExpenses(prev);
      }
    });
  };

  // 已沖銷：保留紀錄(供報表)，但離開卡片、不再扣抵
  const reimburse = (id: string) => {
    const prev = expenses;
    setExpenses((p) => p.filter((e) => e.id !== id));
    startTransition(async () => {
      const res = await setExpenseReimbursedAction(id, true);
      if (!res.ok) {
        alert(res.error ?? "操作失敗");
        setExpenses(prev);
      }
    });
  };

  return (
    <div className="border-t border-zinc-200 bg-amber-50/40 px-5 py-3 space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
        <Fuel className="h-3.5 w-3.5" /> {technicianName} 代墊支出（從應繳現金扣抵）
      </p>

      {expenses.length > 0 && (
        <ul className="space-y-1">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded bg-white px-2.5 py-1.5 text-sm"
            >
              <span className="text-zinc-700">{e.name}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-rose-600">
                  - {formatNTD(Number(e.amount))}
                </span>
                <button
                  type="button"
                  onClick={() => reimburse(e.id)}
                  disabled={pending}
                  className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                  title="已用回繳現金抵掉，保留入報表"
                >
                  <Check className="inline h-3 w-3" /> 已沖銷
                </button>
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  disabled={pending}
                  className="text-zinc-400 hover:text-red-500 disabled:opacity-40"
                  title="刪除(輸入錯誤用)"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 新增支出 */}
      <div className="flex gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="項目，如：加油"
          className="min-w-0 flex-1 rounded border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        />
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="金額"
          className="w-20 rounded border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="shrink-0 rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-40"
        >
          <Plus className="inline h-3.5 w-3.5" /> 新增
        </button>
      </div>

      {/* 對帳摘要 */}
      <div className="space-y-0.5 rounded-lg bg-white px-3 py-2 text-sm">
        <div className="flex items-center justify-between text-zinc-600">
          <span>收款總額</span>
          <span className="font-mono">{formatNTD(cashTotal)}</span>
        </div>
        {expenseTotal > 0 && (
          <div className="flex items-center justify-between text-rose-600">
            <span>代墊支出</span>
            <span className="font-mono">- {formatNTD(expenseTotal)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-zinc-200 pt-1 font-medium text-zinc-900">
          <span>預計繳回現金</span>
          <span className="font-mono text-base">{formatNTD(expectedCash)}</span>
        </div>
      </div>
    </div>
  );
}
