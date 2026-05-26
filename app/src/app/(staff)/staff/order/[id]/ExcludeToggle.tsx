"use client";

import { useTransition } from "react";
import { Ban, RotateCcw } from "lucide-react";
import { toggleOrderItemExcludedAction } from "./service-actions";

/**
 * 師傅標記某品項「不服務」(機器拆不開等)。
 *   - 未勾：紅色按鈕「⊘ 標記不服務」
 *   - 已勾：黃色按鈕「↩ 改回提供服務」
 * trigger refresh_order_totals 會把 excluded=true 的 item 從 orders.total 扣掉。
 */
export function ExcludeToggle({
  orderId,
  orderItemId,
  excluded,
}: {
  orderId: string;
  orderItemId: string;
  excluded: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!excluded && !confirm("確定標記這項為「不服務」？\n金額會從訂單總額扣除（但加減項仍計入）。")) return;
    if (excluded && !confirm("確定要恢復這項為「提供服務」？金額會加回訂單。")) return;
    startTransition(async () => {
      const res = await toggleOrderItemExcludedAction({
        order_id: orderId,
        order_item_id: orderItemId,
        excluded: !excluded,
      });
      if (!res.ok) alert(res.error);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={
        excluded
          ? "inline-flex items-center gap-1 rounded-md border border-amber-400 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 active:bg-amber-100 disabled:opacity-50"
          : "inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-600 active:bg-red-50 disabled:opacity-50"
      }
    >
      {excluded ? (
        <>
          <RotateCcw className="h-3.5 w-3.5" /> 改回提供服務
        </>
      ) : (
        <>
          <Ban className="h-3.5 w-3.5" /> 標記不服務
        </>
      )}
    </button>
  );
}
