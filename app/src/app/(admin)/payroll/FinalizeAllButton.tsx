"use client";

import { useTransition } from "react";
import { Lock } from "lucide-react";
import { finalizeAllTechsForMonth } from "./snapshot-actions";
import { Button } from "@/components/ui/Button";

export function FinalizeAllButton({ month }: { month: string }) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (
      !confirm(
        `一鍵結算 ${month} 所有師傅薪資？\n結算後改抽成設定不會影響此月份數字。已結算的師傅會跳過。`,
      )
    )
      return;
    startTransition(async () => {
      const res = await finalizeAllTechsForMonth(month);
      if (!res.ok) {
        alert(res.error);
      } else {
        alert(`已結算 ${res.count} 位師傅`);
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={pending}
    >
      <Lock className="h-4 w-4" />
      {pending ? "結算中..." : `結算整月`}
    </Button>
  );
}
