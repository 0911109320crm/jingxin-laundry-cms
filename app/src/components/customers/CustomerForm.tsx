"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import {
  CustomerSchema,
  type CustomerInput,
  MACHINE_TYPES,
  MACHINE_TYPE_LABEL,
} from "@/lib/validators/customer";
import {
  COUNTIES,
  DISTRICTS_BY_COUNTY,
  ALL_DISTRICTS,
} from "@/lib/taiwan-regions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { CustomerPicker } from "@/components/customers/CustomerPicker";
import {
  createCustomerAction,
  updateCustomerAction,
  checkDuplicateAddressAction,
  type ActionResult,
  type DuplicateAddressResult,
} from "@/app/(admin)/customers/actions";

type Source = { id: string; name: string };
type MachineBrand = { category: string; name: string };

type Props = {
  sources: Source[];
  /** 全部 active 的機型品牌（用於 datalist 自動完成）。空陣列代表 0007 migration 還沒套用，會退回純 free text。 */
  machineBrands?: MachineBrand[];
  initial?: CustomerInput & { id?: string };
  mode: "create" | "edit";
  customerId?: string;
};

const emptyAddress = {
  county: "彰化縣",
  district: "",
  address: "",
  label: "",
  is_default: true,
};

const emptyMachine = {
  type: "washing_machine" as const,
  brand: "",
  model: "",
  sub_type: "",
  note: "",
};

export function CustomerForm({
  sources,
  machineBrands = [],
  initial,
  mode,
  customerId,
}: Props) {
  // 去重後給 datalist 用（同名品牌可能跨多個 category，例如 LG 跨直立/滾筒）
  const uniqueBrandNames = Array.from(
    new Set(machineBrands.map((b) => b.name)),
  ).sort();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dupWarnings, setDupWarnings] = useState<Record<number, DuplicateAddressResult>>({});

  const checkAddress = useCallback(async (idx: number, county: string, district: string, address: string) => {
    if (!address.trim() || !county || !district) return;
    const result = await checkDuplicateAddressAction(county, district, address, customerId ?? initial?.id);
    setDupWarnings((prev) => ({ ...prev, [idx]: result }));
  }, [customerId, initial?.id]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CustomerInput>({
    resolver: zodResolver(CustomerSchema),
    defaultValues: initial ?? {
      code: "",
      name: "",
      phone: "",
      source_id: null,
      referrer_id: null,
      note: "",
      joined_at: "",
      addresses: [emptyAddress],
      machines: [],
    },
  });

  const addressArr = useFieldArray({ control, name: "addresses" });
  const machineArr = useFieldArray({ control, name: "machines" });
  const watchedAddresses = watch("addresses");

  const onSubmit = (values: CustomerInput) => {
    setServerError(null);
    startTransition(async () => {
      const action: Promise<ActionResult> =
        mode === "create"
          ? createCustomerAction(values)
          : updateCustomerAction(initial!.id!, values);
      const res = await action;
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push("/customers");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>基本資料</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="顧客編號" error={errors.code?.message}>
            <Input {...register("code")} placeholder="例如 C0001" />
          </Field>
          <Field label="姓名" error={errors.name?.message}>
            <Input {...register("name")} placeholder="王小明" />
          </Field>
          <Field label="電話" error={errors.phone?.message}>
            <Input {...register("phone")} placeholder="0912345678" />
          </Field>
          <Field label="客戶來源">
            <Select {...register("source_id")} defaultValue="">
              <option value="">— 未指定 —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="加入日期">
            <Input type="date" {...register("joined_at")} />
          </Field>
          <Field label="介紹人" className="md:col-span-2">
            <Controller
              control={control}
              name="referrer_id"
              render={({ field }) => (
                <CustomerPicker
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v)}
                  excludeId={initial?.id}
                  placeholder="（選填）誰介紹這位客戶？打字搜尋..."
                />
              )}
            />
            <p className="mt-1 text-xs text-zinc-500">
              方便之後追蹤介紹效益、給回饋禮券
            </p>
          </Field>
          <Field label="備註" className="md:col-span-2">
            <Textarea {...register("note")} placeholder="特殊狀況、要注意的事項…" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>地址（可多筆）</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addressArr.append({ ...emptyAddress, is_default: false })}
          >
            <Plus className="h-4 w-4" /> 新增地址
          </Button>
        </CardHeader>
        <CardBody className="space-y-4">
          {addressArr.fields.map((field, idx) => {
            const county = watchedAddresses?.[idx]?.county ?? "";
            const districtList = DISTRICTS_BY_COUNTY[county] ?? ALL_DISTRICTS;
            return (
              <div
                key={field.id}
                className="rounded-lg border border-zinc-200 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">
                    地址 #{idx + 1}
                    {idx === 0 && (
                      <span className="ml-2 text-xs text-brand-600">（預設）</span>
                    )}
                  </span>
                  {addressArr.fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => addressArr.remove(idx)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="縣市" error={errors.addresses?.[idx]?.county?.message}>
                    <Select {...register(`addresses.${idx}.county`)}>
                      {COUNTIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="鄉鎮市區"
                    error={errors.addresses?.[idx]?.district?.message}
                  >
                    <Input
                      list={`districts-${idx}`}
                      {...register(`addresses.${idx}.district`)}
                      placeholder="例如 田尾鄉"
                    />
                    <datalist id={`districts-${idx}`}>
                      {districtList.map((d) => (
                        <option key={d} value={d} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="標籤">
                    <Input
                      {...register(`addresses.${idx}.label`)}
                      placeholder="例如 家 / 公司"
                    />
                  </Field>
                </div>
                <Field
                  label="詳細地址"
                  error={errors.addresses?.[idx]?.address?.message}
                >
                  <Input
                    {...register(`addresses.${idx}.address`)}
                    placeholder="光復路一段146巷40號"
                    onBlur={(e) => {
                      const county = watchedAddresses?.[idx]?.county ?? "";
                      const district = watchedAddresses?.[idx]?.district ?? "";
                      checkAddress(idx, county, district, e.target.value);
                    }}
                  />
                </Field>
                {dupWarnings[idx] && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div className="text-sm">
                      <span className="font-medium text-amber-800">此地址已有舊客戶：</span>
                      <a
                        href={`/customers/${dupWarnings[idx]!.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
                      >
                        {dupWarnings[idx]!.name}（{dupWarnings[idx]!.code}）
                      </a>
                      <span className="ml-2 text-amber-700">{dupWarnings[idx]!.phone}</span>
                    </div>
                  </div>
                )}
                <Controller
                  control={control}
                  name={`addresses.${idx}.is_default`}
                  render={({ field: f }) => (
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={!!f.value}
                        onChange={(e) => f.onChange(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      設為預設地址
                    </label>
                  )}
                />
              </div>
            );
          })}
          {errors.addresses && (
            <p className="text-sm text-red-600">
              {(errors.addresses as { message?: string }).message}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>機器 / 服務物品（可多筆）</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => machineArr.append(emptyMachine)}
          >
            <Plus className="h-4 w-4" /> 新增機器
          </Button>
        </CardHeader>
        <CardBody className="space-y-4">
          {machineArr.fields.length === 0 && (
            <p className="text-sm text-zinc-500">
              尚未登錄機器，可日後在訂單建立時補上。
            </p>
          )}
          {machineArr.fields.map((field, idx) => {
            const savedAddresses = (watchedAddresses ?? []).filter(
              (a) => a.id,
            );
            const showAddressPicker = savedAddresses.length >= 2;
            return (
              <div
                key={field.id}
                className="rounded-lg border border-zinc-200 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">
                    機器 #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => machineArr.remove(idx)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <Field label="類型">
                    <Select {...register(`machines.${idx}.type`)}>
                      {MACHINE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {MACHINE_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="廠牌">
                    <Input
                      {...register(`machines.${idx}.brand`)}
                      placeholder="例如 LG / 大同"
                      list={uniqueBrandNames.length > 0 ? "machine-brands-list" : undefined}
                    />
                  </Field>
                  <Field label="型號">
                    <Input
                      {...register(`machines.${idx}.model`)}
                      placeholder="例如 WT-138RG"
                    />
                  </Field>
                  <Field label="子類型">
                    <Input
                      {...register(`machines.${idx}.sub_type`)}
                      placeholder="例如 直立式 / 滾筒式"
                    />
                  </Field>
                </div>
                {showAddressPicker && (
                  <Field label="主要放在哪個地址？">
                    <Select {...register(`machines.${idx}.address_id`)}>
                      <option value="">— 不指定 —</option>
                      {savedAddresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.county}
                          {a.district}
                          {a.address}
                          {a.label ? `（${a.label}）` : ""}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-1 text-xs text-zinc-500">
                      建單時選此機器，會自動帶這個地址
                    </p>
                  </Field>
                )}
                <Field label="備註">
                  <Textarea
                    {...register(`machines.${idx}.note`)}
                    placeholder="特殊狀況、需要注意的地方…"
                  />
                </Field>
              </div>
            );
          })}
        </CardBody>
      </Card>

      {uniqueBrandNames.length > 0 && (
        <datalist id="machine-brands-list">
          {uniqueBrandNames.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      )}

      {serverError && (
        <Card className="border-red-300 bg-red-50">
          <CardBody>
            <p className="text-sm text-red-700">{serverError}</p>
          </CardBody>
        </Card>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          取消
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "儲存中…" : mode === "create" ? "建立顧客" : "儲存變更"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ? className + " space-y-1.5" : "space-y-1.5"}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
