"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { createServiceTag } from "@/app/(admin)/settings/service-tags/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function NewServiceTagForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (fd: FormData) => {
    startTransition(async () => {
      const res = await createServiceTag(fd);
      if (!res.ok) alert(res.error);
      else formRef.current?.reset();
    });
  };

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="grid grid-cols-[1fr_100px_80px_auto] items-center gap-2"
    >
      <Input name="label" placeholder="例如：洗衣粉、無電梯、有廢水" required />
      <Input
        name="sort_order"
        type="number"
        defaultValue={99}
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
