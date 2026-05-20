"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { createService } from "@/app/(admin)/settings/services/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SERVICE_CATEGORIES, type ServiceCategoryKey } from "./categories";

export function NewServiceForm({
  defaultCategory,
}: {
  defaultCategory?: ServiceCategoryKey;
}) {
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
      className="grid grid-cols-[110px_1fr_100px_140px_80px_70px_auto] items-center gap-2"
    >
      <Input name="code" placeholder="代碼（如 WV-S）" required />
      <Input name="name" placeholder="名稱" required />
      <Input
        name="default_price"
        type="number"
        defaultValue={0}
        placeholder="預設價"
      />
      <Select name="category" defaultValue={defaultCategory ?? ""}>
        <option value="">— 分類 —</option>
        {SERVICE_CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </Select>
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
