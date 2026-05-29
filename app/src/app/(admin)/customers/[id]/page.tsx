import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Pencil,
  Phone,
  MapPin,
  Wrench,
  History,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate, formatNTD } from "@/lib/utils";
import { computeCustomerStats } from "@/lib/customer-stats";
import { MACHINE_TYPE_LABEL } from "@/lib/validators/customer";
import {
  StatusBadge,
  PaymentBadge,
  SettlementBadge,
} from "@/components/orders/StatusBadges";
import type { MachineType } from "@/types/database";
import type { OrderInput } from "@/lib/validators/order";

type CustomerDetail = {
  id: string;
  code: string;
  name: string;
  phone: string;
  note: string | null;
  joined_at: string | null;
  referrer_id: string | null;
  source: { name: string } | null;
  phones: {
    id: string;
    phone: string;
    label: string | null;
    is_primary: boolean;
    sort_order: number;
  }[];
  addresses: {
    id: string;
    county: string;
    district: string;
    address: string;
    label: string | null;
    is_default: boolean;
  }[];
  machines: {
    id: string;
    type: MachineType;
    brand: string | null;
    model: string | null;
    sub_type: string | null;
    note: string | null;
    address_id: string | null;
  }[];
};

type ReferredCustomer = {
  id: string;
  name: string;
  phone: string;
  orders: { status: string; total: number }[];
};

type OrderRow = {
  id: string;
  order_code: string;
  scheduled_at: string | null;
  service_at: string | null;
  status: OrderInput["status"];
  payment_method: OrderInput["payment_method"];
  settlement_status: "pending" | "settled" | "not_required";
  total: number;
  note: string | null;
  cancellation_reason: string | null;
  service_tags: string[] | null;
  service_notes: string | null;
  address: {
    county: string;
    district: string;
    address: string;
    label: string | null;
  } | null;
  items: {
    id: string;
    technician_id: string | null;
    quantity: number;
    unit_price: number;
    tag: string | null;
    note: string | null;
    service: { name: string } | null;
    machine: {
      type: MachineType;
      brand: string | null;
      model: string | null;
    } | null;
  }[];
  adjustments: {
    id: string;
    name_snapshot: string;
    type: "addon" | "discount";
    amount: number;
    note: string | null;
  }[];
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["owner", "manager"]);
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data }, { data: ordersData }, { data: referredData }] = await Promise.all([
    supabase
      .from("customers")
      .select(
        `id, code, name, phone, note, joined_at, referrer_id,
         source:customer_sources(name),
         phones:customer_phones(id, phone, label, is_primary, sort_order),
         addresses:customer_addresses(id, county, district, address, label, is_default),
         machines(id, type, brand, model, sub_type, note, address_id)`,
      )
      .eq("id", id)
      .single(),
    supabase
      .from("orders")
      .select(
        `id, order_code, scheduled_at, service_at, status, payment_method,
         settlement_status, total, note, cancellation_reason,
         service_tags, service_notes,
         address:customer_addresses(county, district, address, label),
         items:order_items(
           id, technician_id, quantity, unit_price, tag, note,
           service:service_items(name),
           machine:machines(type, brand, model)
         ),
         adjustments:order_adjustments(id, name_snapshot, type, amount, note)`,
      )
      .eq("customer_id", id)
      .order("scheduled_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("customers")
      .select("id, name, phone, orders(status, total)")
      .eq("referrer_id", id),
  ]);

  const customer = data as CustomerDetail | null;
  if (!customer) notFound();

  // 介紹人：手動撈一筆（避開 Supabase self-FK embed 的方向歧義）
  let referrer: { id: string; name: string } | null = null;
  if (customer.referrer_id) {
    const { data: refData } = await supabase
      .from("customers")
      .select("id, name")
      .eq("id", customer.referrer_id)
      .single();
    referrer = (refData as { id: string; name: string } | null) ?? null;
  }

  const orders = (ordersData as OrderRow[] | null) ?? [];
  const referredCustomers = (referredData as ReferredCustomer[] | null) ?? [];
  const referredContribution = referredCustomers.reduce((sum, rc) => {
    return (
      sum +
      rc.orders
        .filter((o) => o.status === "done")
        .reduce((s, o) => s + Number(o.total), 0)
    );
  }, 0);

  // Resolve technician names
  const techIds = Array.from(
    new Set(
      orders
        .flatMap((o) => o.items.map((it) => it.technician_id))
        .filter(Boolean) as string[],
    ),
  );
  let techMap = new Map<string, string>();
  if (techIds.length > 0) {
    const { data: techs } = await admin
      .from("user_profiles")
      .select("id, name")
      .in("id", techIds);
    techMap = new Map(
      ((techs ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]),
    );
  }

  const {
    totalSpent,
    doneCount,
    cancelCount,
    lastServiceAt,
    monthsSinceLast,
    avgCycleMonths,
  } = computeCustomerStats(orders);

  return (
    <div className="p-6 space-y-4">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ChevronLeft className="h-4 w-4" /> 回顧客列表
      </Link>

      {(() => {
        const sortedPhones = [...(customer.phones ?? [])].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        );
        // Fallback：DB 沒 customer_phones（不該發生）就退回單支
        const phonesToShow =
          sortedPhones.length > 0
            ? sortedPhones
            : [{
                id: "fallback",
                phone: customer.phone,
                label: null,
                is_primary: true,
                sort_order: 0,
              }];
        return (
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-zinc-900">{customer.name}</h1>
                <span className="text-sm text-zinc-400">{customer.code}</span>
                {customer.source?.name && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                    {customer.source.name}
                  </span>
                )}
                {referrer && (
                  <Link
                    href={`/customers/${referrer.id}`}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                  >
                    由 {referrer.name} 介紹 →
                  </Link>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {phonesToShow.map((p) => (
                  <a
                    key={p.id}
                    href={`tel:${p.phone}`}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium hover:bg-zinc-200 ${
                      p.is_primary
                        ? "bg-zinc-100 text-zinc-800"
                        : "bg-zinc-50 text-zinc-600"
                    }`}
                    title={p.label || (p.is_primary ? "主要" : "副電話")}
                  >
                    <Phone className="h-3.5 w-3.5" /> {p.phone}
                    {p.label && (
                      <span className="ml-1 text-xs text-zinc-500">
                        ({p.label})
                      </span>
                    )}
                  </a>
                ))}
              </div>
              <p className="text-xs text-zinc-500">
                加入：{formatDate(customer.joined_at)}
              </p>
            </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/orders/new?customer=${customer.id}&from=customer&cid=${customer.id}`}
          >
            <Button>
              <Plus className="h-4 w-4" /> 新增訂單
            </Button>
          </Link>
          <Link href={`/customers/${customer.id}/edit`}>
            <Button variant="outline">
              <Pencil className="h-4 w-4" /> 編輯
            </Button>
          </Link>
        </div>
      </header>
        );
      })()}

      {/* KPI 條 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardBody className="py-3">
            <p className="text-xs text-zinc-500">累計消費</p>
            <p className="font-mono text-xl font-bold text-zinc-900">
              {formatNTD(totalSpent)}
            </p>
            <p className="text-xs text-zinc-400">完工 {doneCount} 次</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <p className="text-xs text-zinc-500">距上次服務</p>
            <p
              className={`text-xl font-bold ${
                monthsSinceLast == null
                  ? "text-zinc-400"
                  : monthsSinceLast >= 11
                    ? "text-rose-700"
                    : monthsSinceLast >= 6
                      ? "text-amber-700"
                      : "text-zinc-900"
              }`}
            >
              {monthsSinceLast == null ? "—" : `${monthsSinceLast} 個月`}
            </p>
            <p className="text-xs text-zinc-400">
              {lastServiceAt ? formatDate(lastServiceAt) : "尚無完工紀錄"}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <p className="text-xs text-zinc-500">平均週期</p>
            <p className="text-xl font-bold text-zinc-900">
              {avgCycleMonths == null ? "—" : `${avgCycleMonths} 個月`}
            </p>
            <p className="text-xs text-zinc-400">≥2 次完工才計算</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <p className="text-xs text-zinc-500">臨時取消</p>
            <p
              className={`text-xl font-bold ${
                cancelCount >= 3 ? "text-rose-700" : "text-zinc-900"
              }`}
            >
              {cancelCount} 次
            </p>
            <p className="text-xs text-zinc-400">
              {cancelCount >= 3 ? "客戶常取消，注意" : "—"}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* 備註 / 地址 / 機器 並排：有 note 就 3 欄、沒就 2 欄 */}
      <div
        className={`grid grid-cols-1 gap-4 ${
          customer.note ? "lg:grid-cols-3" : "lg:grid-cols-2"
        }`}
      >
        {customer.note && (
          <Card>
            <CardHeader>
              <CardTitle>客戶備註</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="whitespace-pre-wrap text-sm text-zinc-700">
                {customer.note}
              </p>
            </CardBody>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>地址（{customer.addresses.length} 筆）</CardTitle>
          </CardHeader>
          <CardBody>
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-zinc-500">尚無地址</p>
            ) : (
              <div
                className={`grid grid-cols-1 gap-2 ${
                  customer.note ? "" : "md:grid-cols-2"
                }`}
              >
                {customer.addresses.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg border border-zinc-200 p-2.5 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      <span className="font-medium">
                        {a.county} {a.district}
                      </span>
                      {a.label && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                          {a.label}
                        </span>
                      )}
                      {a.is_default && (
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">
                          預設
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-zinc-700">{a.address}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>機器 / 服務物品（{customer.machines.length} 筆）</CardTitle>
          </CardHeader>
          <CardBody>
            {customer.machines.length === 0 ? (
              <p className="text-sm text-zinc-500">尚未登錄機器</p>
            ) : (
              (() => {
                // 按 address_id 分組；address_id 為 null 的歸「未指定地址」
                const groups = new Map<
                  string | null,
                  typeof customer.machines
                >();
                for (const m of customer.machines) {
                  const key = m.address_id ?? null;
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(m);
                }
                const addressMap = new Map(
                  customer.addresses.map((a) => [a.id, a]),
                );
                // 顯示順序：先按 customer.addresses 順序，最後是未指定
                const orderedKeys: (string | null)[] = [
                  ...customer.addresses.map((a) => a.id).filter((aid) => groups.has(aid)),
                  ...(groups.has(null) ? [null] : []),
                ];
                const showHeading = customer.addresses.length >= 2;
                return (
                  <div className="space-y-3">
                    {orderedKeys.map((aid) => {
                      const machines = groups.get(aid) ?? [];
                      const addr = aid ? addressMap.get(aid) : null;
                      return (
                        <div key={aid ?? "unassigned"}>
                          {showHeading && (
                            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                              <MapPin className="h-3.5 w-3.5" />
                              {addr
                                ? `${addr.county}${addr.district} ${addr.address}${addr.label ? `（${addr.label}）` : ""}`
                                : "未指定地址"}
                            </p>
                          )}
                          <div
                            className={`grid grid-cols-1 gap-2 ${
                              customer.note ? "" : "md:grid-cols-2"
                            }`}
                          >
                            {machines.map((m) => (
                              <div
                                key={m.id}
                                className="rounded-lg border border-zinc-200 p-2.5 text-sm"
                              >
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Wrench className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                                  <span className="font-medium">
                                    {MACHINE_TYPE_LABEL[m.type] ?? m.type}
                                  </span>
                                  {m.sub_type && (
                                    <span className="text-xs text-zinc-500">
                                      {m.sub_type}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-zinc-700">
                                  {[m.brand, m.model].filter(Boolean).join(" / ") || "—"}
                                </p>
                                {m.note && (
                                  <p className="mt-0.5 text-xs text-zinc-500">
                                    備註：{m.note}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {showHeading && groups.has(null) && (
                      <Link
                        href={`/customers/${customer.id}/edit`}
                        className="inline-block text-xs text-brand-700 hover:underline"
                      >
                        → 編輯客戶，幫未指定機器設定地址
                      </Link>
                    )}
                  </div>
                );
              })()
            )}
          </CardBody>
        </Card>
      </div>

      {referredCustomers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>介紹過的客戶（{referredCustomers.length} 位）</span>
              <span className="text-xs font-normal text-zinc-500">
                合計貢獻：
                <span className="font-mono font-semibold text-zinc-900">
                  {formatNTD(referredContribution)}
                </span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-zinc-200">
              {referredCustomers.map((r) => {
                const total = r.orders
                  .filter((o) => o.status === "done")
                  .reduce((s, o) => s + Number(o.total), 0);
                return (
                  <li key={r.id}>
                    <Link
                      href={`/customers/${r.id}`}
                      className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm hover:bg-zinc-50"
                    >
                      <span className="min-w-0 truncate font-medium text-zinc-900">
                        {r.name}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {r.phone} · 累計 {formatNTD(total)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-500" />
            服務歷史（{orders.length} 筆）
            {cancelCount > 0 && (
              <span
                className={`ml-2 rounded px-2 py-0.5 text-xs font-medium ${
                  cancelCount >= 3
                    ? "bg-rose-100 text-rose-800"
                    : "bg-amber-50 text-amber-700"
                }`}
                title={cancelCount >= 3 ? "此客戶常臨時取消" : ""}
              >
                臨時取消 {cancelCount} 次
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {orders.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">尚無服務紀錄</p>
          ) : (
            <div className="divide-y divide-zinc-200">
              {orders.map((o) => {
                const subtotal = o.items.reduce(
                  (s, it) => s + Number(it.quantity) * Number(it.unit_price),
                  0,
                );
                const adjTotal = o.adjustments.reduce(
                  (s, a) =>
                    s + (a.type === "addon" ? Number(a.amount) : -Number(a.amount)),
                  0,
                );
                return (
                  <div key={o.id} className="group relative px-5 py-4 hover:bg-zinc-50/60">
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/orders/${o.id}?from=customer&cid=${customer.id}`}
                          className="font-mono text-xs font-medium text-brand-700 hover:underline"
                        >
                          {o.order_code}
                        </Link>
                        <StatusBadge value={o.status} />
                        <PaymentBadge value={o.payment_method} />
                        {o.settlement_status !== "not_required" && (
                          <SettlementBadge value={o.settlement_status} />
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500">
                          {formatDate(o.service_at ?? o.scheduled_at)}
                        </span>
                        <Link
                          href={`/orders/new?clone=${o.id}&from=customer&cid=${customer.id}`}
                          className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700 hover:bg-brand-100"
                          title="複製此單為新訂單"
                        >
                          複製此單
                        </Link>
                      </div>
                    </div>

                    {/* Address */}
                    {o.address && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-zinc-600">
                        <MapPin className="h-3 w-3 text-zinc-400" />
                        {o.address.county}
                        {o.address.district} {o.address.address}
                        {o.address.label && (
                          <span className="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">
                            {o.address.label}
                          </span>
                        )}
                      </p>
                    )}

                    {/* Items table */}
                    {o.items.length > 0 && (
                      <div className="mt-3 overflow-hidden rounded-md border border-zinc-200">
                        <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-zinc-50 text-zinc-500">
                            <tr>
                              <th className="px-2 py-1.5 text-left font-medium">服務項目</th>
                              <th className="px-2 py-1.5 text-left font-medium">機器</th>
                              <th className="px-2 py-1.5 text-left font-medium">師傅</th>
                              <th className="px-2 py-1.5 text-right font-medium">數量</th>
                              <th className="px-2 py-1.5 text-right font-medium">單價</th>
                              <th className="px-2 py-1.5 text-right font-medium">金額</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {o.items.map((it) => {
                              const machineLabel = it.machine
                                ? [
                                    MACHINE_TYPE_LABEL[it.machine.type] ?? it.machine.type,
                                    [it.machine.brand, it.machine.model]
                                      .filter(Boolean)
                                      .join(" "),
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")
                                : "—";
                              const tech = it.technician_id
                                ? techMap.get(it.technician_id) ?? "—"
                                : "—";
                              const lineAmt =
                                Number(it.quantity) * Number(it.unit_price);
                              return (
                                <tr key={it.id} className="text-zinc-700">
                                  <td className="px-2 py-1.5">
                                    <span>{it.service?.name ?? "—"}</span>
                                    {it.tag && (
                                      <span className="ml-1 rounded bg-zinc-100 px-1 py-0.5 text-[10px] text-zinc-600">
                                        {it.tag}
                                      </span>
                                    )}
                                    {it.note && (
                                      <p className="mt-0.5 text-[11px] text-zinc-500">
                                        {it.note}
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-2 py-1.5 text-zinc-600">{machineLabel}</td>
                                  <td className="px-2 py-1.5 text-zinc-600">{tech}</td>
                                  <td className="px-2 py-1.5 text-right font-mono">{it.quantity}</td>
                                  <td className="px-2 py-1.5 text-right font-mono">
                                    {formatNTD(Number(it.unit_price))}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-mono">
                                    {formatNTD(lineAmt)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    )}

                    {/* Adjustments */}
                    {o.adjustments.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs">
                        {o.adjustments.map((a) => (
                          <li key={a.id} className="flex items-center gap-2 text-zinc-600">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] ${
                                a.type === "addon"
                                  ? "bg-orange-50 text-orange-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {a.type === "addon" ? "加價" : "折扣"}
                            </span>
                            <span>{a.name_snapshot}</span>
                            <span
                              className={`ml-auto font-mono ${
                                a.type === "addon" ? "text-orange-700" : "text-emerald-700"
                              }`}
                            >
                              {a.type === "addon" ? "+" : "-"}
                              {formatNTD(Number(a.amount))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Totals */}
                    <div className="mt-2 flex items-center justify-end gap-4 text-xs text-zinc-600">
                      <span>
                        小計 <span className="font-mono">{formatNTD(subtotal)}</span>
                      </span>
                      {o.adjustments.length > 0 && (
                        <span>
                          加減{" "}
                          <span className="font-mono">
                            {adjTotal >= 0 ? "+" : ""}
                            {formatNTD(adjTotal)}
                          </span>
                        </span>
                      )}
                      <span className="text-sm">
                        應收{" "}
                        <span className="font-mono font-bold text-zinc-900">
                          {formatNTD(Number(o.total))}
                        </span>
                      </span>
                    </div>

                    {/* Note + cancellation reason */}
                    {o.note && (
                      <p className="mt-2 rounded bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
                        建單備註：{o.note}
                      </p>
                    )}
                    {((o.service_tags && o.service_tags.length > 0) ||
                      o.service_notes) && (
                      <div className="mt-2 space-y-1 rounded border border-brand-200 bg-brand-50/40 px-2 py-1.5">
                        <p className="text-[10px] font-medium text-brand-800">
                          師傅現場備註
                        </p>
                        {o.service_tags && o.service_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {o.service_tags.map((t) => (
                              <span
                                key={t}
                                className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-800"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {o.service_notes && (
                          <p className="whitespace-pre-wrap text-xs text-zinc-700">
                            {o.service_notes}
                          </p>
                        )}
                      </div>
                    )}
                    {o.status === "cancelled" && o.cancellation_reason && (
                      <p className="mt-1 text-xs text-rose-700">
                        取消原因：{o.cancellation_reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
