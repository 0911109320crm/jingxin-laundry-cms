"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, X, Check, Wrench } from "lucide-react";
import {
  updateMachineByStaff,
  createMachineForOrderItem,
} from "./machine-actions";
import { Button } from "@/components/ui/Button";

const MACHINE_TYPE_LABEL: Record<string, string> = {
  washing_machine: "洗衣機",
  air_conditioner: "冷氣",
  mattress: "床墊",
  sofa: "沙發",
  other: "其他",
};

const MACHINE_TYPES: Array<{ key: string; label: string }> = [
  { key: "washing_machine", label: "洗衣機" },
  { key: "air_conditioner", label: "冷氣" },
  { key: "mattress", label: "床墊" },
  { key: "sofa", label: "沙發" },
  { key: "other", label: "其他" },
];

/** 把 service_items.category 對應到 machines.type */
function inferMachineType(
  serviceCategory: string | null | undefined,
): string | null {
  if (!serviceCategory) return null;
  if (
    serviceCategory === "washing_vertical" ||
    serviceCategory === "washing_drum"
  )
    return "washing_machine";
  if (serviceCategory === "ac_split" || serviceCategory === "ac_hidden")
    return "air_conditioner";
  if (serviceCategory === "mattress") return "mattress";
  if (serviceCategory === "sofa") return "sofa";
  return null;
}

type MachineLite = {
  id: string;
  type: string;
  brand: string | null;
  model: string | null;
  code: string | null;
};

type BrandOption = { category: string; name: string };

export function MachineEditor({
  orderId,
  orderItemId,
  customerId,
  serviceCategory,
  machine,
  brands,
}: {
  orderId: string;
  orderItemId: string;
  customerId: string;
  serviceCategory: string | null;
  machine: MachineLite | null;
  /** machine_brands 全部清單，用於 datalist 自動完成（依機型分類） */
  brands: BrandOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const inferredType = inferMachineType(serviceCategory);
  const [typeVal, setTypeVal] = useState<string>(
    machine?.type ?? inferredType ?? "washing_machine",
  );
  const [brand, setBrand] = useState<string>(machine?.brand ?? "");
  const [model, setModel] = useState<string>(machine?.model ?? "");
  const [code, setCode] = useState<string>(machine?.code ?? "");

  // Brand datalist: 若機器有 type 用 machine.type 過濾，否則用 serviceCategory 過濾
  const filterCategory =
    machine?.type ?? serviceCategory ?? null;
  // 映射回 machine_brands 的 category（machine_brands 用細分類，service 用細分類，machine.type 用粗分類）
  // 簡單做法：machine.type 是粗的，過濾用 service_category 細的
  const brandCategoryHint =
    filterCategory === "washing_machine" ? null : serviceCategory; // 若只有粗類，顯示全部
  const datalistId = `brands-${orderItemId}`;
  const filteredBrands = brandCategoryHint
    ? brands.filter((b) => b.category === brandCategoryHint)
    : brands;

  const startEdit = () => {
    setTypeVal(machine?.type ?? inferredType ?? "washing_machine");
    setBrand(machine?.brand ?? "");
    setModel(machine?.model ?? "");
    setCode(machine?.code ?? "");
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = () => {
    startTransition(async () => {
      const trimBrand = brand.trim() || null;
      const trimModel = model.trim() || null;
      const trimCode = code.trim() || null;
      if (!trimBrand && !trimModel && !trimCode) {
        alert("請至少填品牌、型號或編碼其中一個");
        return;
      }
      const res = machine
        ? await updateMachineByStaff({
            machine_id: machine.id,
            brand: trimBrand,
            model: trimModel,
            code: trimCode,
          })
        : await createMachineForOrderItem({
            order_id: orderId,
            order_item_id: orderItemId,
            customer_id: customerId,
            type: typeVal as
              | "washing_machine"
              | "air_conditioner"
              | "mattress"
              | "sofa"
              | "other",
            brand: trimBrand,
            model: trimModel,
            code: trimCode,
          });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <div className="flex items-center flex-wrap gap-2 text-xs">
        {machine ? (
          <>
            <Wrench className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-700">
              {MACHINE_TYPE_LABEL[machine.type] ?? machine.type}
              {(machine.brand || machine.model) && (
                <>
                  {" · "}
                  <span className="font-medium">
                    {[machine.brand, machine.model].filter(Boolean).join(" ")}
                  </span>
                </>
              )}
              {!machine.brand && !machine.model && !machine.code && (
                <span className="ml-1 text-zinc-400">（未填品牌 / 型號 / 編碼）</span>
              )}
            </span>
            {machine.code && (
              <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-indigo-700">
                #{machine.code}
              </span>
            )}
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-0.5 text-brand-600 hover:underline"
            >
              <Pencil className="h-3 w-3" /> 編輯
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1 rounded border border-dashed border-zinc-300 px-2 py-1 text-zinc-500 hover:border-brand-400 hover:text-brand-600"
          >
            <Plus className="h-3 w-3" /> 標記機器品牌 / 型號 / 編碼
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-brand-200 bg-brand-50/30 p-2 text-xs">
      {!machine && (
        <div>
          <p className="mb-1 text-zinc-600">機型分類</p>
          <select
            value={typeVal}
            onChange={(e) => setTypeVal(e.target.value)}
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
          >
            {MACHINE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <p className="mb-1 text-zinc-600">品牌</p>
        <input
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="例如 Panasonic / LG"
          list={datalistId}
          maxLength={40}
          className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
        />
        <datalist id={datalistId}>
          {filteredBrands.map((b) => (
            <option key={`${b.category}-${b.name}`} value={b.name} />
          ))}
        </datalist>
      </div>
      <div>
        <p className="mb-1 text-zinc-600">型號</p>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="例如 NA-V158EB"
          maxLength={80}
          className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <p className="mb-1 text-zinc-600">
          機器編碼
          <span className="ml-1 text-zinc-400">
            （給客戶報號用，例 A-01 / AC-1F）
          </span>
        </p>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="可空"
          maxLength={40}
          className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm font-mono"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={cancel}
          disabled={pending}
        >
          <X className="h-3.5 w-3.5" /> 取消
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={pending}>
          <Check className="h-3.5 w-3.5" />
          {pending ? "儲存中..." : "儲存"}
        </Button>
      </div>
    </div>
  );
}
