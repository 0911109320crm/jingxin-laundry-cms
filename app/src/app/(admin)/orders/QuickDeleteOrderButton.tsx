"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteOrderAction } from "@/app/(admin)/orders/actions";

export function QuickDeleteOrderButton({
  id,
  orderCode,
  customerName,
}: {
  id: string;
  orderCode: string;
  customerName: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      !confirm(
        `確定要刪除訂單「${orderCode}（${customerName}）」？\n此操作無法復原。`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteOrderAction(id);
      if (!res.ok) {
        alert(`刪除失敗：${res.error}`);
        return;
      }
      // 保持當前 URL（含 status filter），只 refresh 列表
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title="快速刪除"
      className="inline-flex items-center justify-center rounded-md p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
