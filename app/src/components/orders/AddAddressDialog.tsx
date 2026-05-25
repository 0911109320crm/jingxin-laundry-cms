"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addCustomerAddressAction } from "@/app/(admin)/customers/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { COUNTIES, DISTRICTS_BY_COUNTY } from "@/lib/taiwan-regions";

type Props = {
  customerId: string;
  onSaved: (newAddressId: string) => void;
};

export function AddAddressDialog({ customerId, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [county, setCounty] = useState<string>(COUNTIES[0] ?? "");
  const [district, setDistrict] = useState<string>("");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const districts = DISTRICTS_BY_COUNTY[county] ?? [];

  const reset = () => {
    setCounty(COUNTIES[0] ?? "");
    setDistrict("");
    setAddress("");
    setLabel("");
    setIsDefault(false);
  };

  const submit = () => {
    if (!county || !district || !address.trim()) {
      alert("縣市 / 鄉鎮市區 / 詳細地址都要填");
      return;
    }
    startTransition(async () => {
      const res = await addCustomerAddressAction({
        customer_id: customerId,
        county,
        district,
        address: address.trim(),
        label: label.trim() || null,
        is_default: isDefault,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      onSaved(res.id);
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
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" /> 新增地址
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
              <h2 className="text-base font-bold text-zinc-900">新增客戶地址</h2>
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    縣市
                  </label>
                  <Select
                    value={county}
                    onChange={(e) => {
                      setCounty(e.target.value);
                      setDistrict(""); // 切換縣市時清空鄉鎮
                    }}
                  >
                    {COUNTIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    鄉鎮市區
                  </label>
                  <Select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  >
                    <option value="">— 選擇 —</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  詳細地址
                </label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="例如：中山路 100 號 5 樓"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  地址備註（選填）
                </label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="例如：家、公司、媽媽家"
                  maxLength={30}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4"
                />
                設為此客戶預設地址
              </label>
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
