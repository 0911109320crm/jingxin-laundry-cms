import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Phone, MapPin, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { backTarget, backQueryString } from "@/lib/back";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  StatusBadge,
  PaymentBadge,
  SettlementBadge,
} from "@/components/orders/StatusBadges";
import { formatDateTime, formatNTD } from "@/lib/utils";
import {
  ORDER_STATUS_LABEL,
  type OrderInput,
} from "@/lib/validators/order";
import { MACHINE_TYPE_LABEL } from "@/lib/validators/customer";
import { PromotionsPanel, type OrderPromotion, type PromotionType } from "./PromotionsPanel";

type Item = {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tag: string | null;
  note: string | null;
  service: { code: string; name: string } | null;
  machine: { type: string; brand: string | null; model: string | null } | null;
  technician_id: string | null;
};

type Adjustment = {
  id: string;
  name_snapshot: string;
  type: "addon" | "discount";
  amount: number;
  note: string | null;
};

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
  source: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  service_tags: string[] | null;
  service_notes: string | null;
  customer: { id: string; code: string; name: string; phone: string } | null;
  address: { county: string; district: string; address: string } | null;
  items: Item[];
  adjustments: Adjustment[];
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; cid?: string }>;
}) {
  await requireRole(["owner", "manager"]);
  const { id } = await params;
  const sp = await searchParams;
  const back = backTarget(sp);
  const qs = backQueryString(sp);
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      `id, order_code, status, payment_method, settlement_status,
       scheduled_at, service_at, subtotal, adjustments_total, total,
       note, source, cancellation_reason, cancelled_at,
       service_tags, service_notes,
       customer:customers(id, code, name, phone),
       address:customer_addresses(county, district, address),
       items:order_items(id, quantity, unit_price, subtotal, tag, note,
                         technician_id,
                         service:service_items(code, name),
                         machine:machines(type, brand, model)),
       adjustments:order_adjustments(id, name_snapshot, type, amount, note)`,
    )
    .eq("id", id)
    .single();

  const o = data as Detail | null;
  if (!o) notFound();

  // 促銷積分 + 促銷類型主檔（給 PromotionsPanel）
  const adminForPromos = createAdminClient();
  const [{ data: promoRows }, { data: typeRows }] = await Promise.all([
    adminForPromos
      .from("order_promotions")
      .select("id, promotion_type_id, credited_to, points_snapshot")
      .eq("order_id", id),
    adminForPromos
      .from("promotion_types")
      .select("id, code, label, points")
      .eq("active", true)
      .order("sort_order"),
  ]);
  const orderPromotions = (promoRows as OrderPromotion[] | null) ?? [];
  const promotionTypes = (typeRows as PromotionType[] | null) ?? [];

  // Resolve technician names via admin client
  const techIds = o.items.map((i) => i.technician_id).filter(Boolean) as string[];
  let techMap = new Map<string, string>();
  // All active technicians for the review-attribution dropdown
  const admin = createAdminClient();
  const { data: allTechs } = await admin
    .from("user_profiles")
    .select("id, name")
    .eq("active", true)
    .in("role", ["technician", "manager", "owner"])
    .order("name");
  const allTechList =
    ((allTechs ?? []) as { id: string; name: string }[]) ?? [];
  if (techIds.length > 0) {
    const { data: techs } = await admin
      .from("user_profiles")
      .select("id, name")
      .in("id", techIds);
    techMap = new Map(
      ((techs ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]),
    );
  }
  const defaultTechnicianId =
    (o.items.find((i) => i.technician_id)?.technician_id as string | null) ?? null;

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ChevronLeft className="h-4 w-4" /> {back.label}
        </Link>
        <Link href={`/orders/${o.id}/edit${qs}`}>
          <Button variant="outline">
            <Pencil className="h-4 w-4" /> 編輯
          </Button>
        </Link>
      </div>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-zinc-900 font-mono">
            {o.order_code}
          </h1>
          <StatusBadge value={o.status} />
          <PaymentBadge value={o.payment_method} />
          <SettlementBadge value={o.settlement_status} />
        </div>
        <p className="text-sm text-zinc-500">
          預約：{formatDateTime(o.scheduled_at)}
          {o.service_at && ` · 完工：${formatDateTime(o.service_at)}`}
          {o.source && ` · 來源：${o.source}`}
        </p>
      </header>

      {o.status === "cancelled" && (
        <Card className="border-rose-300 bg-rose-50">
          <CardBody>
            <p className="text-sm font-medium text-rose-800">
              ⚠ 此訂單已取消
            </p>
            <p className="mt-1 text-sm text-rose-700">
              {o.cancellation_reason || "（未填原因）"}
            </p>
            {o.cancelled_at && (
              <p className="mt-1 text-xs text-rose-600">
                取消時間：{formatDateTime(o.cancelled_at)}
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>客戶</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            {o.customer && (
              <>
                <Link
                  href={`/customers/${o.customer.id}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <User className="h-4 w-4 text-zinc-400" />
                  <span className="font-medium text-zinc-900">
                    {o.customer.name}
                  </span>
                  <span className="text-xs text-zinc-400">{o.customer.code}</span>
                </Link>
                <p className="flex items-center gap-2 text-zinc-600">
                  <Phone className="h-4 w-4 text-zinc-400" /> {o.customer.phone}
                </p>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>服務地址</CardTitle>
          </CardHeader>
          <CardBody className="text-sm">
            {o.address && (
              <p className="flex items-center gap-2 text-zinc-700">
                <MapPin className="h-4 w-4 text-zinc-400" />
                {o.address.county} {o.address.district} {o.address.address}
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>服務明細</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <ul className="divide-y divide-zinc-200">
            {o.items.map((it) => (
              <li
                key={it.id}
                className="grid grid-cols-[1fr_auto] gap-2 px-5 py-3 text-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {it.service && (
                      <span className="font-medium text-zinc-900">
                        {it.service.name}
                      </span>
                    )}
                    {it.service && (
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                        {it.service.code}
                      </code>
                    )}
                    {it.tag && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                        {it.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">
                    {it.machine
                      ? `${MACHINE_TYPE_LABEL[it.machine.type as keyof typeof MACHINE_TYPE_LABEL] ?? it.machine.type} · ${[it.machine.brand, it.machine.model].filter(Boolean).join(" ") || "未填型號"}`
                      : "未指定機器"}
                    {it.technician_id &&
                      ` · 師傅：${techMap.get(it.technician_id) ?? "—"}`}
                  </p>
                  {it.note && (
                    <p className="text-xs text-zinc-500">備註：{it.note}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400">
                    {formatNTD(it.unit_price)} × {it.quantity}
                  </p>
                  <p className="font-mono font-medium text-zinc-900">
                    {formatNTD(it.subtotal)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {o.adjustments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>加價 / 折扣</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-zinc-200">
              {o.adjustments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between px-5 py-3 text-sm"
                >
                  <div>
                    <span className="font-medium text-zinc-900">
                      {a.name_snapshot}
                    </span>
                    {a.type === "addon" ? (
                      <span className="ml-2 rounded bg-orange-50 px-1.5 py-0.5 text-xs text-orange-700">
                        加價
                      </span>
                    ) : (
                      <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                        折扣
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-zinc-900">
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
        <CardBody className="space-y-1 text-sm">
          <div className="flex items-center justify-between text-zinc-600">
            <span>項目小計</span>
            <span className="font-mono">{formatNTD(o.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-600">
            <span>加減項</span>
            <span className="font-mono">
              {o.adjustments_total >= 0 ? "+" : ""}
              {formatNTD(o.adjustments_total)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-base font-bold text-zinc-900">
            <span>應收總額</span>
            <span className="font-mono">{formatNTD(o.total)}</span>
          </div>
        </CardBody>
      </Card>

      {o.note && (
        <Card>
          <CardHeader>
            <CardTitle>備註（建單時填寫）</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="whitespace-pre-wrap text-sm text-zinc-700">{o.note}</p>
          </CardBody>
        </Card>
      )}

      {((o.service_tags && o.service_tags.length > 0) || o.service_notes) && (
        <Card className="border-brand-200 bg-brand-50/30">
          <CardHeader>
            <CardTitle>師傅現場備註</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {o.service_tags && o.service_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {o.service_tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {o.service_notes && (
              <p className="whitespace-pre-wrap rounded-md bg-white p-3 text-sm text-zinc-700">
                {o.service_notes}
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <PromotionsPanel
        orderId={o.id}
        promotions={orderPromotions}
        promotionTypes={promotionTypes}
        technicians={allTechList}
        defaultTechnicianId={defaultTechnicianId}
      />
    </div>
  );
}
