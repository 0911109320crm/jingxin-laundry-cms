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
    if (!confirm(`確定要刪除顧客「${name}」？\n相關訂單將無法刪除，需先處理。`)) return;
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
