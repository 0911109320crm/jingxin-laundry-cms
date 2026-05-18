"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { createAdjustment } from "@/app/(admin)/settings/adjustments/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export function NewAdjustmentForm() {
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
      className="grid grid-cols-[1fr_120px_120px_80px_auto] items-center gap-2"
    >
      <Input name="name" placeholder="項目名稱" required />
      <Select name="type" defaultValue="addon">
        <option value="addon">加價</option>
        <option value="discount">折扣</option>
      </Select>
      <Input
        name="default_amount"
        type="number"
        defaultValue={0}
        placeholder="預設金額"
      />
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
