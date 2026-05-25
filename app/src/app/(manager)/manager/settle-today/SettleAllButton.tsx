"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { settleOrdersAction } from "@/app/(admin)/orders/actions";
import { formatNTD } from "@/lib/utils";

export function SettleAllButton({
  orderIds,
  total,
  techName,
}: {
  orderIds: string[];
  total: number;
  techName: string;
}) {
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    if (
      !window.confirm(
        `確認 ${techName} 已交回現金 ${formatNTD(total)}？\n（共 ${orderIds.length} 筆訂單）`,
      )
    )
      return;
    startTransition(async () => {
      const res = await settleOrdersAction(orderIds);
      if (!res.ok) {
        alert(res.error);
        return;
      }
    });
  };

  return (
    <button
      type="button"
      onClick={confirm}
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
    >
      <Check className="h-4 w-4" />
      {pending ? "處理中..." : `確認回繳無誤（${formatNTD(total)}）`}
    </button>
  );
}
