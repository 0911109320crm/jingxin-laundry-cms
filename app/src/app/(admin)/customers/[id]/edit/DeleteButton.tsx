"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteCustomerAction } from "@/app/(admin)/customers/actions";
import { Button } from "@/components/ui/Button";

export function DeleteCustomerButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    // 第一道：一般確認
    if (!confirm(`確定要刪除顧客「${name}」嗎？`)) return;
    // 第二道：強提醒不可復原，並導正「只想刪訂單」的誤操作
    if (
      !confirm(
        `⚠️ 最後確認\n\n刪除後「${name}」的所有資料（地址、機器、電話、聯絡紀錄）將永久消失、無法復原。\n\n※ 若您只是想刪掉某一筆訂單，請按「取消」，改到「訂單」頁面刪除該訂單即可，不要刪顧客。\n\n真的要永久刪除這位顧客嗎？`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteCustomerAction(id);
      if (!res.ok) {
        alert(`刪除失敗：${res.error}`);
      }
    });
  };

  return (
    <Button
      type="button"
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={onClick}
    >
      <Trash2 className="h-4 w-4" />
      {pending ? "刪除中…" : "刪除顧客"}
    </Button>
  );
}
