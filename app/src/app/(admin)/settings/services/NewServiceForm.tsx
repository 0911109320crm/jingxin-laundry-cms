"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { createService } from "@/app/(admin)/settings/services/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export function NewServiceForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (fd: FormData) => {
    startTransition(async () => {
      const res = await createService(fd);
      if (!res.ok) alert(res.error);
      else formRef.current?.reset();
    });
  };

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="grid grid-cols-[80px_1fr_100px_140px_80px_70px_auto] items-center gap-2"
    >
      <Input name="code" placeholder="代碼" required />
      <Input name="name" placeholder="名稱" required />
      <Input
        name="default_price"
        type="number"
        defaultValue={0}
        placeholder="預設價"
      />
      <Select name="category" defaultValue="">
        <option value="">— 分類 —</option>
        <option value="washing_machine">洗衣機</option>
        <option value="air_conditioner">冷氣</option>
        <option value="mattress">床墊</option>
        <option value="sofa">沙發</option>
        <option value="other">其他</option>
      </Select>
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
