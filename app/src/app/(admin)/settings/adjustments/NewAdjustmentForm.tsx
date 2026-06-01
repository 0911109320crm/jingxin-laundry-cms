"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { createAdjustment } from "@/app/(admin)/settings/adjustments/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ADJ_CATEGORY_LABEL, type AdjCategory } from "./categories";

export function NewAdjustmentForm({ category }: { category: AdjCategory }) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (fd: FormData) => {
    startTransition(async () => {
      const res = await createAdjustment(fd);
      if (!res.ok) alert(res.error);
      else formRef.current?.reset();
    });
  };

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="grid grid-cols-1 md:grid-cols-[1fr_110px_110px_70px_auto] md:items-center gap-2"
    >
      <input type="hidden" name="category" value={category} />
      <Input
        name="name"
        placeholder={`新增${ADJ_CATEGORY_LABEL[category]}項目`}
        required
      />
      <Input
        name="default_amount"
        type="number"
        defaultValue={0}
        placeholder="預設金額"
      />
      <label className="flex items-center gap-1.5 text-xs text-zinc-600">
        <input
          type="checkbox"
          name="affects_commission"
          defaultChecked
          className="h-4 w-4"
        />
        進薪資
      </label>
      <label className="flex items-center gap-1 text-sm text-zinc-600">
        <input
          type="checkbox"
          name="active"
          defaultChecked
          className="h-4 w-4"
        />
        啟用
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        <Plus className="h-4 w-4" /> 新增
      </Button>
    </form>
  );
}
