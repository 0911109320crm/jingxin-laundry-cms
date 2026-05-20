"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { createBrand } from "@/app/(admin)/settings/machine-brands/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { CategoryKey } from "./categories";

export function NewBrandForm({ category }: { category: CategoryKey }) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (fd: FormData) => {
    startTransition(async () => {
      const res = await createBrand(fd);
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
      <input type="hidden" name="category" value={category} />
      <Input name="name" placeholder="例：Panasonic" required />
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
