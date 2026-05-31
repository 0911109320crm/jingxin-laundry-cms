"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, AlertTriangle, Phone, Star } from "lucide-react";
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
  nextCustomerCodeAction,
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

const emptyPhone = {
  phone: "",
  label: "",
  is_primary: false,
};

const emptyMachine = {
  type: "washing_vertical" as const,
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
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CustomerInput>({
    resolver: zodResolver(CustomerSchema),
    defaultValues: initial ?? {
      code: "",
      name: "",
      source_id: null,
      referrer_id: null,
      note: "",
      joined_at: "",
      phones: [{ phone: "", label: "", is_primary: true }],
      addresses: [emptyAddress],
      machines: [],
    },
  });

  const phoneArr = useFieldArray({ control, name: "phones" });
  const addressArr = useFieldArray({ control, name: "addresses" });
  const machineArr = useFieldArray({ control, name: "machines" });

  // 建單模式：mount 時自動帶入下個 C 流水編號（老闆娘仍可手動覆寫）
  useEffect(() => {
    if (mode !== "create") return;
    if (getValues("code")) return; // 已有值不覆蓋（譬如複製單）
    nextCustomerCodeAction()
      .then((code) => {
        if (!getValues("code")) setValue("code", code);
      })
      .catch(() => {
        // 失敗就讓老闆娘自己填，不擋流程
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const watchedAddresses = watch("addresses");
  const watchedPhones = watch("phones");

  // 點選某筆「設為主要」 → 把其他 phone 全部設為 false
  const setPrimary = useCallback(
    (idx: number) => {
      const cur = getValues("phones");
      setValue(
        "phones",
        cur.map((p, i) => ({ ...p, is_primary: i === idx })),
        { shouldDirty: true, shouldValidate: true },
      );
    },
    [getValues, setValue],
  );

  const removePhone = useCallback(
    (idx: number) => {
      const cur = getValues("phones");
      const wasPrimary = cur[idx]?.is_primary;
      phoneArr.remove(idx);
      // 如果刪掉的是主電話，把第一支補成主
      if (wasPrimary) {
        setTimeout(() => {
          const after = getValues("phones");
          if (after.length > 0 && !after.some((p) => p.is_primary)) {
            setValue(
              "phones",
              after.map((p, i) => ({ ...p, is_primary: i === 0 })),
              { shouldDirty: true },
            );
          }
        }, 0);
      }
    },
    [getValues, phoneArr, setValue],
  );

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
          <Field
            label={mode === "create" ? "顧客編號（已自動帶下個流水，可改）" : "顧客編號"}
            error={errors.code?.message}
          >
            <Input {...register("code")} placeholder="C00001" />
          </Field>
          <Field label="姓名" error={errors.name?.message}>
            <Input {...register("name")} placeholder="王小明" />
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
          <CardTitle>聯絡電話（可多筆）</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => phoneArr.append({ ...emptyPhone })}
          >
            <Plus className="h-4 w-4" /> 新增電話
          </Button>
        </CardHeader>
        <CardBody className="space-y-3">
          {phoneArr.fields.map((field, idx) => {
            const isPrimary = watchedPhones?.[idx]?.is_primary ?? false;
            return (
              <div
                key={field.id}
                className={`flex flex-wrap items-end gap-2 rounded-lg border p-3 ${
                  isPrimary ? "border-brand-300 bg-brand-50/40" : "border-zinc-200"
                }`}
              >
                <Field
                  label={`電話 #${idx + 1}`}
                  error={errors.phones?.[idx]?.phone?.message}
                  className="min-w-[180px] flex-1"
                >
                  <Input
                    {...register(`phones.${idx}.phone`)}
                    placeholder="0912345678"
                    inputMode="tel"
                  />
                </Field>
                <Field label="標籤（選填）" className="min-w-[160px] flex-1">
                  <Input
                    {...register(`phones.${idx}.label`)}
                    placeholder="例：本人 / 老公 / 公司"
                  />
                </Field>
                <div className="flex items-center gap-2">
                  {isPrimary ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800">
                      <Star className="h-3.5 w-3.5 fill-current" /> 主要
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPrimary(idx)}
                      className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                    >
                      設為主要
                    </button>
                  )}
                  {phoneArr.fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhone(idx)}
                      className="text-red-600 hover:text-red-700"
                      aria-label="刪除此電話"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {errors.phones && !Array.isArray(errors.phones) && (
            <p className="text-sm text-red-600">
              {(errors.phones as { message?: string }).message}
            </p>
          )}
          <p className="text-xs text-zinc-500">
            <Phone className="mr-1 inline h-3 w-3" />
            主要電話會顯示在客戶清單；副電話含標籤（本人/老公/公司…）可在客戶頁查到
          </p>
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
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                <Field label="標籤">
                  <Input
                    {...register(`addresses.${idx}.label`)}
                    placeholder="例如 家 / 公司"
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
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
