"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteOrderAction } from "@/app/(admin)/orders/actions";
import { Button } from "@/components/ui/Button";

export function DeleteOrderButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm("確定刪除這筆訂單？此操作無法復原。")) return;
    startTransition(async () => {
      const res = await deleteOrderAction(id);
      if (!res.ok) alert(`刪除失敗：${res.error}`);
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
      {pending ? "刪除中…" : "刪除訂單"}
    </Button>
  );
}
