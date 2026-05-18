"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { settleOrdersAction } from "@/app/(admin)/orders/actions";
import { Button } from "@/components/ui/Button";
import { formatNTD } from "@/lib/utils";

export function SettleBatchButton({
  orderIds,
  technicianName,
  total,
}: {
  orderIds: string[];
  technicianName: string;
  total: number;
}) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (
      !confirm(
        `確認 ${technicianName} 已交來現金 ${formatNTD(total)}（${orderIds.length} 筆）？\n標記為「已回繳」後將從待回繳清單移除。`,
      )
    )
      return;
    startTransition(async () => {
      const res = await settleOrdersAction(orderIds);
      if (!res.ok) alert(res.error);
    });
  };

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={pending || orderIds.length === 0}
    >
      <CheckCheck className="h-4 w-4" />
      {pending ? "處理中…" : "全部標記已回繳"}
    </Button>
  );
}
