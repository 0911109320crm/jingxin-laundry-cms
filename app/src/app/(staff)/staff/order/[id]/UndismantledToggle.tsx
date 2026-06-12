"use client";

import { useTransition } from "react";
import { toggleOrderItemUndismantledAction } from "./service-actions";

/**
 * 師傅勾「未拆解」(機器沒拆開洗)。
 * 影響薪資技術獎金（每台 +未拆解加給），不影響訂單金額。
 */
export function UndismantledToggle({
  orderId,
  orderItemId,
  undismantled,
}: {
  orderId: string;
  orderItemId: string;
  undismantled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const onChange = () => {
    startTransition(async () => {
      const res = await toggleOrderItemUndismantledAction({
        order_id: orderId,
        order_item_id: orderItemId,
        undismantled: !undismantled,
      });
      if (!res.ok) alert(res.error);
    });
  };

  return (
    <label
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
        undismantled
          ? "border-violet-400 bg-violet-50 text-violet-800"
          : "border-zinc-300 bg-white text-zinc-600"
      } ${pending ? "opacity-50" : ""}`}
    >
      <input
        type="checkbox"
        checked={undismantled}
        onChange={onChange}
        disabled={pending}
        className="h-4 w-4 accent-violet-500"
      />
      未拆解
    </label>
  );
}
