"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, X, Check, Wrench } from "lucide-react";
import {
  updateMachineByStaff,
  createMachineForOrderItem,
} from "./machine-actions";
import { Button } from "@/components/ui/Button";
import {
  MACHINE_TYPES as MACHINE_TYPE_KEYS,
  MACHINE_TYPE_LABEL,
} from "@/lib/validators/customer";

// 師傅新增機器的下拉選項（與顧客端共用同一組細分類型）
const MACHINE_TYPES: Array<{ key: string; label: string }> = MACHINE_TYPE_KEYS.map(
  (k) => ({ key: k, label: MACHINE_TYPE_LABEL[k] }),
);

// 品牌英文 → 中文對照（顯示「中文 英文」方便師傅辨識）
const BRAND_ZH: Record<string, string> = {
  "Panasonic": "國際牌",
  "HITACHI": "日立",
  "TOSHIBA": "東芝",
  "SHARP": "夏普",
  "LG": "樂金",
  "SAMSUNG": "三星",
  "SAMPO": "聲寶",
  "TECO": "東元",
  "HERAN": "禾聯",
  "SANLUX": "台灣三洋",
  "TATUNG": "大同",
  "CHIMEI": "奇美",
  "Whirlpool": "惠而浦",
  "BOSCH": "博世",
  "Electrolux": "伊萊克斯",
  "DAIKIN": "大金",
  "Mitsubishi Heavy Industries": "三菱重工",
  "Mitsubishi Electric": "三菱電機",
  "FUJITSU": "富士通",
};

function brandLabel(name: string): string {
  const zh = BRAND_ZH[name];
  return zh ? `${zh} ${name}` : name;
}

/** 把 service_items.category 對應到 machines.type。
 *  機器類型已細分(0027)，與 service_items.category 同一套詞彙，可直接帶入。 */
function inferMachineType(
  serviceCategory: string | null | undefined,
): string | null {
  if (!serviceCategory) return null;
  const known = [
    "washing_vertical",
    "washing_twin_tub",
    "washing_drum",
    "ac_split",
    "ac_hidden",
    "mattress",
    "sofa",
  ];
  return known.includes(serviceCategory) ? serviceCategory : null;
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
    machine?.type ?? inferredType ?? "washing_vertical",
  );
  const [brand, setBrand] = useState<string>(machine?.brand ?? "");
  const [model, setModel] = useState<string>(machine?.model ?? "");
  const [code, setCode] = useState<string>(machine?.code ?? "");

  // Brand select 過濾：用 serviceCategory（service_items.category，細分類）
  // machine_brands.category 也是細分類，可直接 match
  const brandCategoryHint =
    serviceCategory && serviceCategory !== "washing_machine" ? serviceCategory : null;
  const filteredBrands = brandCategoryHint
    ? brands.filter((b) => b.category === brandCategoryHint)
    : brands;
  // 去重（跨 category 的同名品牌如 LG 在直立+滾筒+冷氣都有，只顯示一次）
  // 不再自行排序：保留老闆娘在「機型品牌主檔」設定的 sort_order（brands 已依 sort_order 帶入）
  const uniqueBrandNames = Array.from(
    new Set(filteredBrands.map((b) => b.name)),
  );

  // 「其他」選項 (free text input)：選中時顯示一個 input 讓師傅打字
  const isOtherBrand = brand !== "" && !uniqueBrandNames.includes(brand);
  const [useOther, setUseOther] = useState(isOtherBrand);

  const startEdit = () => {
    setTypeVal(machine?.type ?? inferredType ?? "washing_vertical");
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
            type: typeVal as (typeof MACHINE_TYPE_KEYS)[number],
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
        {useOther ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="輸入品牌名稱"
              maxLength={40}
              className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                setUseOther(false);
                setBrand("");
              }}
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-600 active:bg-zinc-100"
            >
              ↩ 改回下拉
            </button>
          </div>
        ) : (
          <select
            value={uniqueBrandNames.includes(brand) ? brand : ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__other__") {
                setUseOther(true);
                setBrand("");
              } else {
                setBrand(v);
              }
            }}
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">— 請選擇品牌 —</option>
            {uniqueBrandNames.map((name) => (
              <option key={name} value={name}>
                {brandLabel(name)}
              </option>
            ))}
            <option value="__other__">其他（手動輸入）...</option>
          </select>
        )}
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
