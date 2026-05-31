"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { DateTimeSelect } from "@/components/ui/DateTimeSelect";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  createOrderAction,
  updateOrderAction,
  getCustomerContext,
  previewOrderCodeAction,
} from "@/app/(admin)/orders/actions";
import { AddAddressDialog } from "@/components/orders/AddAddressDialog";
import { CustomerPicker } from "@/components/customers/CustomerPicker";
import { AddressPicker } from "@/components/orders/AddressPicker";
import { formatNTD } from "@/lib/utils";

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
  address_id?: string | null;
};

type Props = {
  technicians: Technician[];
  services: Service[];
  adjustments: Adjustment[];
  mode: "create" | "edit";
  /** Edit mode: full snapshot with id. Create mode (clone): no id required. */
  initial?: OrderInput & {
    id?: string;
    addresses?: Address[];
    machines?: Machine[];
  };
  defaultCustomerId?: string;
  defaultScheduledAt?: string;
  /** Where to navigate after successful create/update. */
  backHref?: string;
  /** Edit mode: existing order_code for display. */
  orderCode?: string;
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
  technicians,
  services,
  adjustments,
  mode,
  initial,
  defaultCustomerId,
  defaultScheduledAt,
  backHref,
  orderCode,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [addresses, setAddresses] = useState<Address[]>(initial?.addresses ?? []);
  const [machines, setMachines] = useState<Machine[]>(initial?.machines ?? []);
  const [previewCode, setPreviewCode] = useState<string>("");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderInput>({
    resolver: zodResolver(OrderSchema),
    defaultValues: initial
      ? {
          ...initial,
          scheduled_at: initial.scheduled_at ?? (defaultScheduledAt ?? ""),
        }
      : {
          customer_id: defaultCustomerId ?? "",
          address_id: "",
          scheduled_at: defaultScheduledAt ?? "",
          scheduled_end_at: "",
          service_at: "",
          duration_minutes: 90,
          status: "pending",
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
  const scheduledAt = useWatch({ control, name: "scheduled_at" });

  // Duration in minutes：edit 模式優先用 initial.duration_minutes（DB 存的），
  // 否則從 scheduled_at + scheduled_end_at 推（舊資料 backfill 失敗時的 fallback），
  // 都沒有就 90。
  const initialDuration = (() => {
    if (initial?.duration_minutes && initial.duration_minutes > 0) {
      return initial.duration_minutes;
    }
    if (initial?.scheduled_at && initial?.scheduled_end_at) {
      const s = new Date(initial.scheduled_at).getTime();
      const e = new Date(initial.scheduled_end_at).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && e > s) {
        return Math.round((e - s) / 60000);
      }
    }
    return 90;
  })();
  const [duration, setDuration] = useState<number>(initialDuration);

  // 把 duration state 同步到表單，submit 才會帶到 server
  useEffect(() => {
    setValue("duration_minutes", duration);
  }, [duration, setValue]);

  // 把 UTC ISO 轉成瀏覽器當地的 "YYYY-MM-DDTHH:mm"（供 DateTimeSelect 使用）。
  // 修正 prod 上 server timezone ≠ 客戶端時的顯示偏移問題。
  useEffect(() => {
    const toLocal = (s: string | null | undefined): string | null => {
      if (!s) return null;
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null; // 已是本地格式，不動
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    for (const field of ["scheduled_at", "scheduled_end_at", "service_at"] as const) {
      const cur = initial?.[field];
      const local = toLocal(cur);
      if (local) setValue(field, local);
    }
    // 只在 mount 跑一次（讓 ISO 轉成本地顯示），後續使用者輸入由 DateTimeSelect 管理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-derive scheduled_end_at from scheduled_at + duration
  useEffect(() => {
    if (!scheduledAt) return;
    const start = new Date(scheduledAt);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + (duration || 0));
    const pad = (n: number) => String(n).padStart(2, "0");
    const value = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
    setValue("scheduled_end_at", value);
  }, [scheduledAt, duration, setValue]);

  // 機器 → 地址自動連動：選機器後若訂單地址還空著，帶上該機器的歸屬地址
  const watchedAddressId = useWatch({ control, name: "address_id" });
  useEffect(() => {
    if (watchedAddressId) return; // 已選地址就不覆寫
    const firstWithMachine = watchedItems?.find((it) => it?.machine_id);
    if (!firstWithMachine?.machine_id) return;
    const machine = machines.find((m) => m.id === firstWithMachine.machine_id);
    if (machine?.address_id) {
      setValue("address_id", machine.address_id);
    }
  }, [watchedItems, machines, watchedAddressId, setValue]);

  // Preview order code (create mode only)
  useEffect(() => {
    if (mode !== "create") return;
    const dateStr = scheduledAt ? scheduledAt.slice(0, 10) : undefined;
    let cancelled = false;
    previewOrderCodeAction(dateStr).then((code) => {
      if (!cancelled) setPreviewCode(code);
    });
    return () => { cancelled = true; };
  }, [mode, scheduledAt]);

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
    })();
    return () => {
      cancel = true;
    };
  }, [customerId, initial?.customer_id]);

  // Auto-select address after the addresses state has rerendered
  // （拆成獨立 effect，確保 <option> DOM 已渲染 setValue 才能生效）
  useEffect(() => {
    if (addresses.length === 0) {
      if (watchedAddressId) setValue("address_id", "");
      return;
    }
    // 若使用者已選好或表單 initial 帶值，不覆蓋
    if (watchedAddressId && addresses.some((a) => a.id === watchedAddressId)) return;
    const def = addresses.find((a) => a.is_default) ?? addresses[0];
    setValue("address_id", def.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses]);

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

  // 把 datetime-local 字串 "YYYY-MM-DDTHH:mm"（瀏覽器當地時區）轉成帶時區的 ISO，
  // 避免 Postgres timestamptz 把無時區字串當 UTC 存（08:00 台灣會變成 16:00）。
  const localToIso = (s: string | null | undefined): string | null => {
    if (!s) return null;
    if (/[Z]|[+-]\d{2}:?\d{2}$/.test(s)) return s; // 已含時區
    const d = new Date(s); // 瀏覽器當地時區解析
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const onSubmit = (values: OrderInput) => {
    setServerError(null);
    const normalized: OrderInput = {
      ...values,
      scheduled_at: localToIso(values.scheduled_at),
      scheduled_end_at: localToIso(values.scheduled_end_at),
      service_at: localToIso(values.service_at),
    };
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createOrderAction(normalized)
          : await updateOrderAction(initial!.id!, normalized);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      // 建單模式：永遠跳到 detail 頁顯示「同客戶再建一筆」CTA（即使有 backHref 也忽略）
      // 編輯模式：跳回使用者來源頁（backHref）
      let target: string;
      if (mode === "create" && res.id) {
        const params = new URLSearchParams();
        params.set("just_created", "1");
        const from = searchParams?.get("from");
        const cid = searchParams?.get("cid");
        if (from) params.set("from", from);
        if (cid) params.set("cid", cid);
        target = `/orders/${res.id}?${params.toString()}`;
      } else {
        target = backHref ?? "/orders";
      }
      router.push(target);
      router.refresh();
    });
  };

  const setServiceDefaults = (idx: number, serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (svc) setValue(`items.${idx}.unit_price`, svc.default_price);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>客戶 / 排程</CardTitle>
          {mode === "create" && previewCode && (
            <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-mono text-xs text-zinc-500">
              預計編號：{previewCode}
            </span>
          )}
          {mode === "edit" && orderCode && (
            <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-mono text-xs text-zinc-500">
              {orderCode}
            </span>
          )}
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <Field label="客戶" error={errors.customer_id?.message}>
            <Controller
              control={control}
              name="customer_id"
              render={({ field }) => (
                <CustomerPicker
                  value={field.value || null}
                  onChange={(id) => field.onChange(id ?? "")}
                  placeholder="打字搜尋客戶（姓名 / 電話 / 編號）..."
                />
              )}
            />
          </Field>
          <Field label="服務地址" error={errors.address_id?.message}>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <Controller
                  control={control}
                  name="address_id"
                  render={({ field }) => (
                    <AddressPicker
                      addresses={addresses}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      disabled={addresses.length === 0}
                    />
                  )}
                />
              </div>
              {customerId && (
                <AddAddressDialog
                  customerId={customerId}
                  onSaved={async (newId) => {
                    // 重新撈該客戶的地址列表，並選用剛新增的那筆
                    const ctx = await getCustomerContext(customerId);
                    setAddresses(ctx.addresses);
                    setMachines(ctx.machines);
                    setValue("address_id", newId);
                  }}
                />
              )}
            </div>
          </Field>
          <Field label="預約開始時間">
            <Controller
              control={control}
              name="scheduled_at"
              render={({ field }) => (
                <DateTimeSelect
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>
          <Field label="預計時長（分鐘）">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                min={0}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 0)}
                placeholder="自訂 45 / 80…"
                className="w-28"
              />
              <span className="text-xs text-zinc-400">或快選：</span>
              <div className="flex gap-1">
                {[60, 90, 120, 180].map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setDuration(m)}
                    className={`rounded border px-2.5 py-1.5 text-xs transition-colors ${
                      duration === m
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {m} 分
                  </button>
                ))}
              </div>
            </div>
            <input type="hidden" {...register("scheduled_end_at")} />
          </Field>
          {mode === "edit" && (
            <Field label="實際清洗日期時間（一般不填，師傅按完成時會自動設）">
              <Controller
                control={control}
                name="service_at"
                render={({ field }) => (
                  <DateTimeSelect
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
            </Field>
          )}
          {mode === "edit" && (
            <Field label="訂單狀態">
              <Select {...register("status")}>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {mode === "create" && (
            <input type="hidden" {...register("status")} value="pending" />
          )}
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
          <Field label="備註" className="xl:col-span-2">
            <Textarea
              {...register("note")}
              placeholder="特殊狀況、客戶要求…"
            />
          </Field>
        </CardBody>
      </Card>

      <div className="space-y-5">
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
        {mode === "create" && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800 space-y-0.5">
            <p>💡 新建訂單只需選機型大類（含基本價），實際品牌/容量/加減項由師傅現場補。</p>
            <p>單價暫定為基本價，師傅換成實際品項後總額會自動更新。</p>
            <p>📅 若已知有師傅可接 → 在下方「指派師傅」直接選 + 預約日期填好，訂單會直接進「已排案」。否則留空 → 進「待派工」之後到月曆拖曳。</p>
          </div>
        )}
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
                            {/* WV-S/WTUB 這類英文代號是內部 SKU，老闆娘只看中文品名 + 價格 */}
                            {s.name}（{formatNTD(s.default_price)}）
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
                <Field label={mode === "create" ? "基本價（鎖定）" : "單價"}>
                  <Input
                    type="number"
                    min={0}
                    readOnly={mode === "create"}
                    className={mode === "create" ? "bg-zinc-100 text-zinc-500" : ""}
                    {...register(`items.${idx}.unit_price`, { valueAsNumber: true })}
                  />
                </Field>
              </div>
              <div
                className={
                  mode === "edit" || machines.length > 0
                    ? "grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px]"
                    : "grid grid-cols-1 gap-3"
                }
              >
                {/* 5a：建單時若此客戶已登錄機器，老闆娘可直接帶入（不再只能選預設基本價）。
                    客戶沒登錄機器時（create 模式）就不顯示，維持精簡。 */}
                {(mode === "edit" || machines.length > 0) && (
                  <Field
                    label={
                      mode === "create"
                        ? "帶入此客戶的機器（可選）"
                        : "機器（可選）"
                    }
                  >
                    <Select {...register(`items.${idx}.machine_id`)}>
                      <option value="">— 不指定機器 —</option>
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {MACHINE_TYPE_LABEL[m.type as keyof typeof MACHINE_TYPE_LABEL] ?? m.type} ·{" "}
                          {[m.brand, m.model].filter(Boolean).join(" ") || "未填型號"}
                        </option>
                      ))}
                    </Select>
                    {(() => {
                      const selectedMachineId = watchedItems?.[idx]?.machine_id;
                      if (!selectedMachineId) return null;
                      const m = machines.find((mm) => mm.id === selectedMachineId);
                      if (!m?.address_id) return null;
                      if (!watchedAddressId || m.address_id === watchedAddressId)
                        return null;
                      const machineAddr = addresses.find(
                        (a) => a.id === m.address_id,
                      );
                      if (!machineAddr) return null;
                      return (
                        <div className="mt-1 flex items-start gap-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                          <span className="shrink-0">⚠</span>
                          <span className="min-w-0 flex-1">
                            此機器在「{machineAddr.county}
                            {machineAddr.district}
                            {machineAddr.address}」，但本單地址不同。
                            <button
                              type="button"
                              onClick={() =>
                                setValue("address_id", m.address_id!)
                              }
                              className="ml-1 font-medium underline hover:text-amber-900"
                            >
                              切換到此地址
                            </button>
                          </span>
                        </div>
                      );
                    })()}
                  </Field>
                )}
                <Field label="設備資訊">
                  <Input
                    {...register(`items.${idx}.tag`)}
                    placeholder="補充此項說明，例：陽台那台、客廳冷氣"
                    maxLength={50}
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
            <p className="text-xs text-zinc-500">
              {mode === "create" ? "暫估總額（師傅補實際品項後更新）" : "應收總額"}
            </p>
            <p className="text-2xl font-bold text-brand-700">
              {formatNTD(total)}
            </p>
          </div>
        </CardBody>
      </Card>
      </div>
      </div>

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
