"use client";

import { useTransition } from "react";
import { Lock, LockOpen } from "lucide-react";
import {
  finalizeTechMonth,
  unfinalizeTechMonth,
} from "@/app/(admin)/payroll/snapshot-actions";
import { Button } from "@/components/ui/Button";

export function FinalizeButtons({
  technicianId,
  month,
  techName,
  finalized,
  isOwner,
}: {
  technicianId: string;
  month: string;
  techName: string;
  finalized: boolean;
  isOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const onFinalize = () => {
    if (
      !confirm(
        `確定要結算「${techName}」${month} 的薪資？\n結算後，改設定不會影響此月份的薪資數字（凍結快照）。`,
      )
    )
      return;
    startTransition(async () => {
      const res = await finalizeTechMonth(technicianId, month);
      if (!res.ok) alert(res.error);
    });
  };

  const onUnfinalize = () => {
    if (
      !confirm(
        `確定要解除「${techName}」${month} 的結算？\n解除後系統會即時重算當月薪資（依目前抽成設定）。`,
      )
    )
      return;
    startTransition(async () => {
      const res = await unfinalizeTechMonth(technicianId, month);
      if (!res.ok) alert(res.error);
    });
  };

  if (finalized) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <Lock className="h-3.5 w-3.5" /> 已結算鎖定
        </span>
        {isOwner && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onUnfinalize}
            disabled={pending}
          >
            <LockOpen className="h-4 w-4" /> 解除結算
          </Button>
        )}
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={onFinalize}
      disabled={pending}
    >
      <Lock className="h-4 w-4" />
      {pending ? "結算中..." : "結算本月"}
    </Button>
  );
}
