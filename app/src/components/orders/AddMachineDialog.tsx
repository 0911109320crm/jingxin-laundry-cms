"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import {
  addCustomerMachineAction,
  type QuickMachine,
} from "@/app/(admin)/customers/actions";
import { MACHINE_TYPES, MACHINE_TYPE_LABEL } from "@/lib/validators/customer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type AddressLite = {
  id: string;
  county: string;
  district: string;
  address: string;
  label: string | null;
};

type Props = {
  customerId: string;
  /** 該客戶地址清單；>=2 筆時讓老闆娘指定機器放在哪個地址 */
  addresses?: AddressLite[];
  /** 預設帶入的地址（通常是本單地址） */
  defaultAddressId?: string | null;
  onSaved: (machine: QuickMachine) => void;
};

export function AddMachineDialog({
  customerId,
  addresses = [],
  defaultAddressId,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<string>(MACHINE_TYPES[0] ?? "washing_vertical");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [addressId, setAddressId] = useState<string>(defaultAddressId ?? "");

  const reset = () => {
    setType(MACHINE_TYPES[0] ?? "washing_vertical");
    setBrand("");
    setModel("");
    setAddressId(defaultAddressId ?? "");
  };

  const submit = () => {
    if (!type) {
      alert("請選機器類型");
      return;
    }
    startTransition(async () => {
      const res = await addCustomerMachineAction({
        customer_id: customerId,
        type: type as (typeof MACHINE_TYPES)[number],
        brand: brand.trim() || null,
        model: model.trim() || null,
        address_id: addressId || null,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      onSaved(res.machine);
      reset();
      setOpen(false);
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!customerId}
        onClick={() => {
          setAddressId(defaultAddressId ?? "");
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" /> 新增機器
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => !pending && setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 className="text-base font-bold text-zinc-900">新增客戶機器</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">類型</label>
                <Select value={type} onChange={(e) => setType(e.target.value)}>
                  {MACHINE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MACHINE_TYPE_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    廠牌（選填）
                  </label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="例如 國際 / LG"
                    maxLength={40}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    型號（選填）
                  </label>
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="例如 WT-138RG"
                    maxLength={80}
                  />
                </div>
              </div>
              {addresses.length >= 2 && (
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    機器放在哪個地址（選填）
                  </label>
                  <Select
                    value={addressId}
                    onChange={(e) => setAddressId(e.target.value)}
                  >
                    <option value="">— 不指定 —</option>
                    {addresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.county}
                        {a.district}
                        {a.address}
                        {a.label ? `（${a.label}）` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                取消
              </Button>
              <Button type="button" disabled={pending} onClick={submit}>
                {pending ? "儲存中..." : "儲存並選用"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
