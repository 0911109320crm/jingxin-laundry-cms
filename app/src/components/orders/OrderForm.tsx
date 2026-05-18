"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import {
  OrderSchema,
  type OrderInput,
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
} from "@/lib/validators/order";
import { MACHINE_TYPE_LABEL } from "@/lib/validators/customer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  createOrderAction,
  updateOrderAction,
  getCustomerContext,
} from "@/app/(admin)/orders/actions";
import { formatNTD } from "@/lib/utils";

type Customer = { id: string; code: string; name: string; phone: string };
type Technician = { id: string; name: string };
type Service = {
  id: string;
  code: string;
  name: string;
  default_price: number;
};
type Adjustment = {
  id: string;
  name: string;
  type: "addon" | "discount";
  default_amount: number;
};
type Address = {
  id: string;
  county: string;
  district: string;
  address: string;
  label: string | null;
  is_default: boolean;
};
type Machine = {
  id: string;
  type: string;
  brand: string | null;
  model: string | null;
  sub_type: string | null;
};

type Props = {
  customers: Customer[];
  technicians: Technician[];
  services: Service[];
  adjustments: Adjustment[];
  mode: "create" | "edit";
  initial?: OrderInput & {
    id: string;
    addresses: Address[];
    machines: Machine[];
  };
  defaultCustomerId?: string;
  defaultScheduledAt?: string;
  /** Where to navigate after successful create/update. */
  backHref?: string;
};

const emptyItem = {
  service_item_id: "",
  technician_id: null,
  quantity: 1,
  unit_price: 0,
  machine_id: null,
  tag: "",
  note: "",
};

export function OrderForm({
  customers,
  technicians,
  services,
  adjustments,
  mode,
  initial,
  defaultCustomerId,
  defaultScheduledAt,
  backHref,
}: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [addresses, setAddresses] = useState<Address[]>(initial?.addresses ?? []);
  const [machines, setMachines] = useState<Machine[]>(initial?.machines ?? []);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderInput>({
    resolver: zodResolver(OrderSchema),
    defaultValues: initial ?? {
      customer_id: defaultCustomerId ?? "",
      address_id: "",
      scheduled_at: defaultScheduledAt ?? "",
      service_at: "",
      status: "scheduled",
      payment_method: "unpaid",
      note: "",
      source: "",
      items: [emptyItem],
      adjustments: [],
    },
  });

  const itemArr = useFieldArray({ control, name: "items" });
  const adjArr = useFieldArray({ control, name: "adjustments" });
  const customerId = useWatch({ control, name: "customer_id" });
  const watchedItems = useWatch({ control, name: "items" });
  const watchedAdjustments = useWatch({ control, name: "adjustments" });

  // Auto-fetch addresses/machines when customer changes
  useEffect(() => {
    if (!customerId) {
      setAddresses([]);
      setMachines([]);
      return;
    }
    if (initial?.customer_id === customerId) return; // already populated
    let cancel = false;
    (async () => {
      const ctx = await getCustomerContext(customerId);
      if (cancel) return;
      setAddresses(ctx.addresses);
      setMachines(ctx.machines);
      if (ctx.addresses.length > 0) {
        const def = ctx.addresses.find((a) => a.is_default) ?? ctx.addresses[0];
        setValue("address_id", def.id);
      } else {
        setValue("address_id", "");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [customerId, initial?.customer_id, setValue]);

  const subtotal = (watchedItems ?? []).reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0,
  );
  const adjTotal = (watchedAdjustments ?? []).reduce(
    (s, a) =>
      s + (a.type === "addon" ? Number(a.amount) : -Number(a.amount)),
    0,
  );
  const total = subtotal + adjTotal;

  const onSubmit = (values: OrderInput) => {
    setServerError(null);
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createOrderAction(values)
          : await updateOrderAction(initial!.id, values);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push(backHref ?? (res.id ? `/orders/${res.id}` : "/orders"));
      router.refresh();
    });
  };

  const setServiceDefaults = (idx: number, serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (svc) setValue(`items.${idx}.unit_price`, svc.default_price);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>客戶 / 排程</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="客戶" error={errors.customer_id?.message}>
            <Select {...register("customer_id")}>
              <option value="">— 選擇客戶 —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone} · {c.code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="服務地址" error={errors.address_id?.message}>
            <Select {...register("address_id")} disabled={addresses.length === 0}>
              <option value="">
                {addresses.length === 0 ? "— 先選客戶 —" : "— 選擇地址 —"}
              </option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.county} {a.district} {a.address}
                  {a.label ? ` (${a.label})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="預約開始時間">
            <Input
              type="datetime-local"
              {...register("scheduled_at")}
            />
          </Field>
          <Field label="預約結束時間">
            <Input
              type="datetime-local"
              {...register("scheduled_end_at")}
            />
          </Field>
          <Field label="實際清洗日期時間">
            <Input type="datetime-local" {...register("service_at")} />
          </Field>
          <Field label="訂單狀態">
            <Select {...register("status")}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="收款狀態">
            <Select {...register("payment_method")}>
              {PAYMENT_METHODS.map((p) => (
                <option key={p} value={p}>
                  {PAYMENT_METHOD_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="訂單來源">
            <Input
              {...register("source")}
              placeholder="電話 / LINE / 官網表單..."
            />
          </Field>
          <Field label="備註" className="md:col-span-2">
            <Textarea
              {...register("note")}
              placeholder="特殊狀況、客戶要求…"
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>服務項目（可多項）</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => itemArr.append(emptyItem)}
          >
            <Plus className="h-4 w-4" /> 新增一項
          </Button>
        </CardHeader>
        <CardBody className="space-y-3">
          {itemArr.fields.map((field, idx) => (
            <div
              key={field.id}
              className="rounded-lg border border-zinc-200 p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-700">
                  第 {idx + 1} 項
                </span>
                {itemArr.fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => itemArr.remove(idx)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_80px_120px]">
                <Field
                  label="服務項目"
                  error={errors.items?.[idx]?.service_item_id?.message}
                >
                  <Controller
                    control={control}
                    name={`items.${idx}.service_item_id`}
                    render={({ field: f }) => (
                      <Select
                        value={f.value ?? ""}
                        onChange={(e) => {
                          f.onChange(e.target.value);
                          setServiceDefaults(idx, e.target.value);
                        }}
                      >
                        <option value="">— 選擇 —</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} · {s.name}（{formatNTD(s.default_price)}）
                          </option>
                        ))}
                      </Select>
                    )}
                  />
                </Field>
                <Field label="指派師傅">
                  <Select {...register(`items.${idx}.technician_id`)}>
                    <option value="">— 未指派 —</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="數量">
                  <Input
                    type="number"
                    min={1}
                    {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                  />
                </Field>
                <Field label="單價">
                  <Input
                    type="number"
                    min={0}
                    {...register(`items.${idx}.unit_price`, { valueAsNumber: true })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_100px]">
                <Field label="機器（可選）">
                  <Select {...register(`items.${idx}.machine_id`)}>
                    <option value="">— 不指定機器 —</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {MACHINE_TYPE_LABEL[m.type as keyof typeof MACHINE_TYPE_LABEL] ?? m.type} ·{" "}
                        {[m.brand, m.model].filter(Boolean).join(" ") || "未填型號"}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="代號（遠/母/卡…）">
                  <Input
                    {...register(`items.${idx}.tag`)}
                    placeholder="可空"
                    maxLength={4}
                  />
                </Field>
              </div>
            </div>
          ))}
          {errors.items?.message && (
            <p className="text-sm text-red-600">{errors.items.message}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>加價 / 折扣（可多項）</CardTitle>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                adjArr.append({
                  name_snapshot: "",
                  type: "addon",
                  amount: 0,
                  note: "",
                })
              }
            >
              <Plus className="h-4 w-4" /> 加價
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                adjArr.append({
                  name_snapshot: "",
                  type: "discount",
                  amount: 0,
                  note: "",
                })
              }
            >
              <Plus className="h-4 w-4" /> 折扣
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {adjArr.fields.length === 0 && (
            <p className="text-sm text-zinc-500">尚未新增加價或折扣</p>
          )}
          {adjArr.fields.map((field, idx) => (
            <div
              key={field.id}
              className="grid grid-cols-1 items-end gap-3 rounded-lg border border-zinc-200 p-3 md:grid-cols-[1fr_120px_120px_auto]"
            >
              <Field label="名稱">
                <Controller
                  control={control}
                  name={`adjustments.${idx}.name_snapshot`}
                  render={({ field: f }) => (
                    <Input
                      list={`adj-suggestions-${watchedAdjustments?.[idx]?.type ?? "addon"}`}
                      value={f.value ?? ""}
                      onChange={(e) => {
                        f.onChange(e.target.value);
                        // auto-fill amount if matches a master item
                        const item = adjustments.find(
                          (a) => a.name === e.target.value,
                        );
                        if (item) {
                          setValue(`adjustments.${idx}.amount`, item.default_amount);
                          setValue(`adjustments.${idx}.adjustment_item_id`, item.id);
                          setValue(`adjustments.${idx}.type`, item.type);
                        }
                      }}
                      placeholder="例如：加大、拆壞零件、節慶折扣"
                    />
                  )}
                />
                <datalist id="adj-suggestions-addon">
                  {adjustments
                    .filter((a) => a.type === "addon")
                    .map((a) => (
                      <option key={a.id} value={a.name} />
                    ))}
                </datalist>
                <datalist id="adj-suggestions-discount">
                  {adjustments
                    .filter((a) => a.type === "discount")
                    .map((a) => (
                      <option key={a.id} value={a.name} />
                    ))}
                </datalist>
              </Field>
              <Field label="類型">
                <Select {...register(`adjustments.${idx}.type`)}>
                  <option value="addon">加價</option>
                  <option value="discount">折扣</option>
                </Select>
              </Field>
              <Field label="金額">
                <Input
                  type="number"
                  min={0}
                  {...register(`adjustments.${idx}.amount`, { valueAsNumber: true })}
                />
              </Field>
              <button
                type="button"
                onClick={() => adjArr.remove(idx)}
                className="text-red-600 hover:text-red-700 pb-2"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex items-center justify-between text-sm">
          <div className="space-y-1 text-zinc-600">
            <p>
              項目小計：<span className="font-mono">{formatNTD(subtotal)}</span>
            </p>
            <p>
              加減項：
              <span className="font-mono">
                {adjTotal >= 0 ? "+" : ""}
                {formatNTD(adjTotal)}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">應收總額</p>
            <p className="text-2xl font-bold text-brand-700">
              {formatNTD(total)}
            </p>
          </div>
        </CardBody>
      </Card>

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
          {pending ? "儲存中…" : mode === "create" ? "建立訂單" : "儲存變更"}
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
