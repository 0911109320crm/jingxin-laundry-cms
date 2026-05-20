"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { createPromotionType } from "@/app/(admin)/settings/promotion-types/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function NewPromotionTypeForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (fd: FormData) => {
    startTransition(async () => {
      const res = await createPromotionType(fd);
      if (!res.ok) alert(res.error);
      else formRef.current?.reset();
    });
  };

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="grid grid-cols-[160px_1fr_70px_70px_80px_auto] items-center gap-2"
    >
      <Input name="code" placeholder="代碼（小寫底線）" required />
      <Input name="label" placeholder="顯示文字（例：FB按讚）" required />
      <Input
        name="points"
        type="number"
        min={0}
        defaultValue={1}
        placeholder="分數"
      />
      <Input
        name="sort_order"
        type="number"
        defaultValue={999}
        placeholder="排序"
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
