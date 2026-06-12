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
      className="grid grid-cols-1 md:grid-cols-[100px_1fr_90px_120px_110px_56px_70px_60px_auto] md:items-center gap-2"
    >
      <Input name="code" placeholder="代碼" required />
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
        name="unit_bonus"
        type="number"
        min={0}
        step="any"
        defaultValue={0}
        placeholder="每台獎金"
        title="師傅做這個品項每台的技術獎金"
      />
      <Input
        name="sort_order"
        type="number"
        defaultValue={999}
        placeholder="排序"
      />
      <label className="flex items-center justify-center gap-1 text-sm text-zinc-600" title="老闆娘建單頁顯示">
        <input
          type="checkbox"
          name="is_basic_choice"
          className="h-4 w-4 accent-amber-500"
        />
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
