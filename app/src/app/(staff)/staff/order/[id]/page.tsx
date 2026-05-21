import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Phone, MapPin } from "lucide-react";
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
import { MACHINE_TYPE_LABEL } from "@/lib/validators/customer";
import { StaffActions } from "./StaffActions";
import { PromotionsToggle } from "./PromotionsToggle";

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
  note: string | null;
  service_tags: string[] | null;
  service_notes: string | null;
  customer_id: string;
  customer: { name: string; phone: string } | null;
  address: { county: string; district: string; address: string } | null;
  items: {
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    tag: string | null;
    note: string | null;
    technician_id: string | null;
    service: { code: string; name: string } | null;
    machine: { type: string; brand: string | null; model: string | null } | null;
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
       scheduled_at, service_at, subtotal, adjustments_total, total, note,
       service_tags, service_notes, customer_id,
       customer:customers(name, phone),
       address:customer_addresses(county, district, address),
       items:order_items(id, quantity, unit_price, subtotal, tag, note,
                         technician_id,
                         service:service_items(code, name),
                         machine:machines(type, brand, model)),
       adjustments:order_adjustments(id, name_snapshot, type, amount)`,
    )
    .eq("id", id)
    .single();

  const o = data as Detail | null;
  if (!o) notFound();

  const myItems = o.items.filter((it) => it.technician_id === me.id);

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
            <a
              href={`tel:${o.customer.phone}`}
              className="inline-flex items-center gap-2 text-sm text-brand-700"
            >
              <Phone className="h-4 w-4" /> {o.customer.phone}
            </a>
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
          <CardTitle>我的服務項目（{myItems.length}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {myItems.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">
              這筆訂單沒有分配給你的項目
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {myItems.map((it) => (
                <li
                  key={it.id}
                  className="grid grid-cols-[1fr_auto] gap-2 px-4 py-3 text-sm"
                >
                  <div className="space-y-1">
                    {it.service && (
                      <p className="font-medium text-zinc-900">
                        {it.service.name}
                      </p>
                    )}
                    <p className="text-xs text-zinc-500">
                      {it.machine
                        ? `${MACHINE_TYPE_LABEL[it.machine.type as keyof typeof MACHINE_TYPE_LABEL] ?? it.machine.type} · ${[it.machine.brand, it.machine.model].filter(Boolean).join(" ") || "未填型號"}`
                        : "未指定機器"}
                      {it.tag && ` · ${it.tag}`}
                    </p>
                    {it.note && (
                      <p className="text-xs text-amber-700">⚠ {it.note}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">
                      {formatNTD(it.unit_price)} × {it.quantity}
                    </p>
                    <p className="font-mono font-medium">
                      {formatNTD(it.subtotal)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {o.adjustments.length > 0 && (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-zinc-200">
              {o.adjustments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span>
                    {a.name_snapshot}{" "}
                    <span
                      className={
                        a.type === "addon"
                          ? "text-orange-600"
                          : "text-blue-600"
                      }
                    >
                      ({a.type === "addon" ? "加" : "折"})
                    </span>
                  </span>
                  <span className="font-mono">
                    {a.type === "addon" ? "+" : "-"}
                    {formatNTD(a.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="flex items-center justify-between">
          <span className="text-sm text-zinc-600">應收總額</span>
          <span className="text-2xl font-bold text-brand-700 font-mono">
            {formatNTD(o.total)}
          </span>
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

      {myItems.length > 0 && (
        <PromotionsToggle
          orderId={o.id}
          promotionTypes={promotionTypes}
          myPromotions={myPromotions}
          myUserId={me.id}
        />
      )}

      <StaffActions
        orderId={o.id}
        currentPayment={o.payment_method}
        isDone={o.status === "done"}
        presets={presets}
        initialTags={o.service_tags ?? []}
        initialNotes={o.service_notes ?? ""}
        adjustments={o.adjustments}
        adjustmentItems={adjustmentItems}
        subtotal={o.subtotal}
        adjustmentsTotal={o.adjustments_total}
        total={o.total}
      />
    </div>
  );
}
