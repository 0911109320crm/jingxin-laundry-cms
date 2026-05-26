import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";
import { PhoneList } from "@/components/customers/PhoneList";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  StatusBadge,
  PaymentBadge,
  SettlementBadge,
} from "@/components/orders/StatusBadges";
import { formatDateTime, formatNTD } from "@/lib/utils";
import type { OrderInput } from "@/lib/validators/order";
import { OrderWorkflow } from "./OrderWorkflow";
import { MachineEditor } from "./MachineEditor";
import { ServiceItemSwapper } from "./ServiceItemSwapper";
import { ExcludeToggle } from "./ExcludeToggle";

type Detail = {
  id: string;
  order_code: string;
  status: OrderInput["status"];
  payment_method: OrderInput["payment_method"];
  settlement_status: "pending" | "settled" | "not_required";
  scheduled_at: string | null;
  service_at: string | null;
  subtotal: number;
  adjustments_total: number;
  total: number;
  estimated_total: number | null;
  note: string | null;
  service_tags: string[] | null;
  service_notes: string | null;
  customer_id: string;
  customer: {
    name: string;
    phone: string;
    phones: { id: string; phone: string; label: string | null; is_primary: boolean }[];
  } | null;
  address: { county: string; district: string; address: string } | null;
  items: {
    id: string;
    item_code: string | null;
    excluded: boolean;
    service_item_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    tag: string | null;
    note: string | null;
    technician_id: string | null;
    service: { code: string; name: string; category: string | null } | null;
    machine: {
      id: string;
      type: string;
      brand: string | null;
      model: string | null;
      code: string | null;
    } | null;
  }[];
  adjustments: {
    id: string;
    name_snapshot: string;
    type: "addon" | "discount";
    amount: number;
  }[];
};

type PriorNote = {
  id: string;
  order_code: string;
  service_at: string | null;
  service_tags: string[] | null;
  service_notes: string | null;
};

export default async function StaffOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      `id, order_code, status, payment_method, settlement_status,
       scheduled_at, service_at, subtotal, adjustments_total, total, estimated_total, note,
       service_tags, service_notes, customer_id,
       customer:customers(name, phone,
                          phones:customer_phones(id, phone, label, is_primary)),
       address:customer_addresses(county, district, address),
       items:order_items(id, item_code, excluded, service_item_id, quantity, unit_price, subtotal, tag, note,
                         technician_id,
                         service:service_items(code, name, category),
                         machine:machines(id, type, brand, model, code)),
       adjustments:order_adjustments(id, name_snapshot, type, amount)`,
    )
    .eq("id", id)
    .single();

  const o = data as Detail | null;
  if (!o) notFound();

  // Load active tag presets (with category) for the complete dialog
  const { data: presetsData } = await supabase
    .from("service_tag_presets")
    .select("id, category, label, sort_order")
    .eq("active", true)
    .order("sort_order");
  const presets =
    (presetsData as {
      id: string;
      category: string | null;
      label: string;
      sort_order: number;
    }[] | null) ?? [];

  // machine_brands 給機器編輯器當 datalist autocomplete
  const { data: brandsData } = await supabase
    .from("machine_brands")
    .select("category, name")
    .eq("active", true)
    .order("category")
    .order("sort_order");
  const brands =
    (brandsData as { category: string; name: string }[] | null) ?? [];

  // 加減項預設清單
  const { data: adjItemsData } = await supabase
    .from("adjustment_items")
    .select("id, name, type, default_amount")
    .eq("active", true)
    .order("type")
    .order("name");
  const adjustmentItems =
    (adjItemsData as {
      id: string;
      name: string;
      type: "addon" | "discount";
      default_amount: number;
    }[] | null) ?? [];

  // 全部 active service_items (含非 basic_choice) — 給師傅換實際品項用
  const { data: allServicesData } = await supabase
    .from("service_items")
    .select("id, code, name, category, default_price")
    .eq("active", true)
    .order("sort_order");
  const allServices =
    (allServicesData as {
      id: string;
      code: string;
      name: string;
      category: string | null;
      default_price: number;
    }[] | null) ?? [];

  // 促銷積分：取 active 類型清單 + 本訂單已歸屬給我的紀錄
  const [{ data: promoTypesData }, { data: myPromosData }] = await Promise.all([
    supabase
      .from("promotion_types")
      .select("id, code, label, points")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("order_promotions")
      .select("id, promotion_type_id, points_snapshot")
      .eq("order_id", id)
      .eq("credited_to", me.id),
  ]);
  const promotionTypes =
    (promoTypesData as { id: string; code: string; label: string; points: number }[] | null) ?? [];
  const myPromotions =
    (myPromosData as { id: string; promotion_type_id: string; points_snapshot: number }[] | null) ?? [];

  // Load same customer's prior orders with tags/notes (so 接續師傅 knows quirks)
  const { data: priorData } = await supabase
    .from("orders")
    .select("id, order_code, service_at, service_tags, service_notes")
    .eq("customer_id", o.customer_id)
    .neq("id", o.id)
    .or("service_tags.neq.{},service_notes.not.is.null")
    .order("service_at", { ascending: false, nullsFirst: false })
    .limit(5);
  const priorNotes = ((priorData as PriorNote[] | null) ?? []).filter(
    (p) => (p.service_tags && p.service_tags.length > 0) || p.service_notes,
  );

  return (
    <div className="p-4 space-y-3">
      <Link
        href="/staff"
        className="inline-flex items-center gap-1 text-sm text-zinc-500"
      >
        <ChevronLeft className="h-4 w-4" /> 回今日案件
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-zinc-500">{o.order_code}</span>
          <StatusBadge value={o.status} />
          <PaymentBadge value={o.payment_method} />
          {o.settlement_status !== "not_required" && (
            <SettlementBadge value={o.settlement_status} />
          )}
        </div>
        <p className="text-xs text-zinc-500">
          預約：{formatDateTime(o.scheduled_at)}
        </p>
      </header>

      {o.customer && (
        <Card>
          <CardBody className="space-y-2">
            <p className="text-base font-bold text-zinc-900">
              {o.customer.name}
            </p>
            <PhoneList
              primary={o.customer.phone}
              phones={o.customer.phones}
              mode="stack"
            />
            {o.address && (
              <p className="flex items-start gap-2 text-sm text-zinc-700">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${o.address.county}${o.address.district}${o.address.address}`,
                  )}`}
                  target="_blank"
                  rel="noopener"
                  className="text-brand-700 underline"
                >
                  {o.address.county} {o.address.district} {o.address.address}
                </a>
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>服務項目（{o.items.length}）</CardTitle>
        </CardHeader>
        {o.estimated_total != null && o.estimated_total !== Number(o.total) && (
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-1.5 text-xs text-zinc-600">
            老闆娘暫估：<span className="font-mono">{formatNTD(o.estimated_total)}</span>
            <span className="mx-1">→</span>
            目前實際：<span className="font-mono font-medium text-zinc-900">{formatNTD(o.total)}</span>
          </div>
        )}
        <CardBody className="p-0">
          <ul className="divide-y divide-zinc-200">
            {o.items.map((it) => (
              <li key={it.id} className={`space-y-1.5 px-4 py-3 ${it.excluded ? "bg-zinc-50" : ""}`}>
                {it.item_code && (
                  <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5">
                    <span className="text-xs font-medium text-amber-900">📋 保固單編號</span>
                    <span className="font-mono text-base font-bold text-amber-900 tracking-wide select-all">
                      {it.item_code}
                    </span>
                  </div>
                )}
                {it.excluded && (
                  <div className="rounded-md bg-amber-50 border border-amber-300 px-2.5 py-1 text-xs text-amber-800">
                    ⚠ 此項已標記「不服務」，金額不計入訂單總額（加減項仍計入）
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${it.excluded ? "text-zinc-400 line-through" : "text-zinc-900"}`}>
                      {it.service?.name ?? "—"}
                      {it.quantity > 1 && (
                        <span className="ml-1 text-zinc-500">× {it.quantity}</span>
                      )}
                    </p>
                  </div>
                  <span className={`font-mono text-sm ${it.excluded ? "text-zinc-400 line-through" : "text-zinc-700"}`}>
                    {formatNTD(it.subtotal)}
                  </span>
                </div>
                <div className="flex justify-end">
                  <ExcludeToggle
                    orderId={o.id}
                    orderItemId={it.id}
                    excluded={it.excluded}
                  />
                </div>
                <ServiceItemSwapper
                  orderId={o.id}
                  orderItemId={it.id}
                  currentServiceId={it.service_item_id}
                  currentServiceCategory={it.service?.category ?? null}
                  currentQuantity={it.quantity}
                  services={allServices}
                />
                <MachineEditor
                  orderId={o.id}
                  orderItemId={it.id}
                  customerId={o.customer_id}
                  serviceCategory={it.service?.category ?? null}
                  machine={it.machine}
                  brands={brands}
                />
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {o.note && (
        <Card>
          <CardHeader>
            <CardTitle>老闆娘交辦</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="whitespace-pre-wrap text-sm text-zinc-700">{o.note}</p>
          </CardBody>
        </Card>
      )}

      {priorNotes.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="text-amber-900">
              ⚠ 此客戶過往師傅備註
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 p-3">
            {priorNotes.map((p) => (
              <div
                key={p.id}
                className="rounded-md border border-amber-200 bg-white p-2.5 text-sm"
              >
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="font-mono">{p.order_code}</span>
                  <span>{p.service_at?.slice(0, 10) ?? ""}</span>
                </div>
                {p.service_tags && p.service_tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.service_tags.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {p.service_notes && (
                  <p className="mt-1 whitespace-pre-wrap text-zinc-700">
                    {p.service_notes}
                  </p>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* This order's existing tags/notes (after completion) */}
      {((o.service_tags && o.service_tags.length > 0) || o.service_notes) && (
        <Card>
          <CardHeader>
            <CardTitle>本案備註</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {o.service_tags && o.service_tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {o.service_tags.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {o.service_notes && (
              <p className="whitespace-pre-wrap text-sm text-zinc-700">
                {o.service_notes}
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <OrderWorkflow
        orderId={o.id}
        currentPayment={o.payment_method}
        isDone={o.status === "done"}
        subtotal={o.subtotal}
        items={o.items.map((it) => ({
          id: it.id,
          service_name: it.service?.name ?? null,
          quantity: it.quantity,
          subtotal: Number(it.subtotal),
        }))}
        initialAdjustments={o.adjustments}
        adjustmentItems={adjustmentItems}
        presets={presets}
        initialTags={o.service_tags ?? []}
        initialNotes={o.service_notes ?? ""}
        promotionTypes={promotionTypes}
        initialPromotions={myPromotions}
        myUserId={me.id}
      />
    </div>
  );
}
