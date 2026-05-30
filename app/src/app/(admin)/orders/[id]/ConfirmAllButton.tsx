"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { confirmAllItemsAction } from "@/app/(admin)/orders/actions";
import { Button } from "@/components/ui/Button";

/**
 * 老闆娘兜底：代所有師傅確認金額、放行收款。
 * 用於師傅做完忘了在手機確認就離開，導致最後收款師傅卡住收不了款。
 */
export function ConfirmAllButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = () => {
    if (
      !confirm(
        "確認要代所有師傅標記「金額已確認」、放行收款嗎？\n（用於師傅忘了在手機上確認就離開的情況）",
      )
    )
      return;
    startTransition(async () => {
      const res = await confirmAllItemsAction(orderId);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={onClick}>
      <Check className="h-4 w-4" /> 代為確認、放行收款
    </Button>
  );
}
