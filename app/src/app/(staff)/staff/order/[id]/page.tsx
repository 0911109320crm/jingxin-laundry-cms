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
import { formatDateTime, formatNTD, formatTaiwanDate } from "@/lib/utils";
import type { OrderInput } from "@/lib/validators/order";
import { OrderWorkflow } from "./OrderWorkflow";
import { MachineEditor } from "./MachineEditor";
import { ServiceItemSwapper } from "./ServiceItemSwapper";
import { ExcludeToggle } from "./ExcludeToggle";
import { UndismantledToggle } from "./UndismantledToggle";

type Detail = {
  id: string;
  order_code: string;
  status: OrderInput["status"];
  payment_method: OrderInput["payment_method"];
  settlement_status: "pending" | "settled" | "not_required";
  collected_by_technician_id: string | null;
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
    undismantled: boolean;
    confirmed: boolean;
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
    order_item_id: string | null;
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

// 服務項目大分類 → 明顯色框（師傅一眼分辨機型）
const CATEGORY_FRAME: Record<
  string,
  { border: string; chip: string; label: string }
> = {
  washing_vertical: { border: "border-blue-400", chip: "bg-blue-50 text-blue-700", label: "直立式洗衣機" },
  washing_twin_tub: { border: "border-blue-400", chip: "bg-blue-50 text-blue-700", label: "雙槽式洗衣機" },
  washing_drum: { border: "border-green-500", chip: "bg-green-50 text-green-700", label: "滾筒洗衣機" },
  ac_split: { border: "border-orange-400", chip: "bg-orange-50 text-orange-700", label: "分離式冷氣" },
  ac_hidden: { border: "border-orange-400", chip: "bg-orange-50 text-orange-700", label: "吊隱式冷氣" },
  sofa: { border: "border-red-400", chip: "bg-red-50 text-red-700", label: "沙發" },
  mattress: { border: "border-red-400", chip: "bg-red-50 text-red-700", label: "床墊" },
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StaffOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;

  // ── 主管級預覽他人訂單：?as=<techId> → 純唯讀（看得到、不能操作）──
  // 防越權同 /staff：能否預覽完全由「真實登入者角色/旗標」決定，不信任網址。
  // 唯讀只做在前端（不出按鈕）：對受信任的 owner/manager 是「防誤按」而非「防弊」，
  // 後端 action 維持 owner/manager 兜底全權不削弱（老闆娘代收款/修單仍要能用）。
  const canPreview =
    me.profile.role === "owner" || me.profile.role === "manager";
  const asId =
    typeof sp.as === "string" && UUID_RE.test(sp.as) ? sp.as : null;
  const previewing = !!asId && canPreview && asId !== me.id;
  const backHref = previewing ? `/staff?as=${asId}` : "/staff";

  const supabase = await createClient();
  // 預覽他人訂單時用 admin client 繞 RLS（已由 canPreview 把關）；自己的單走 RLS。
  const db = previewing
    ? (await import("@/lib/supabase/admin")).createAdminClient()
    : supabase;
  const { data } = await db
    .from("orders")
    .select(
      `id, order_code, status, payment_method, settlement_status, collected_by_technician_id,
       scheduled_at, service_at, subtotal, adjustments_total, total, estimated_total, note,
       service_tags, service_notes, customer_id,
       customer:customers(name, phone,
                          phones:customer_phones(id, phone, label, is_primary)),
       address:customer_addresses(county, district, address),
       items:order_items(id, item_code, excluded, undismantled, confirmed, service_item_id, quantity, unit_price, subtotal, tag, note,
                         technician_id,
                         service:service_items(code, name, category),
                         machine:machines(id, type, brand, model, code)),
       adjustments:order_adjustments(id, order_item_id, name_snapshot, type, amount)`,
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
    .select("id, name, type, category, default_amount")
    .eq("active", true)
    .order("category")
    .order("name");
  const adjustmentItems =
    (adjItemsData as {
      id: string;
      name: string;
      type: "addon" | "discount";
      category: "service" | "parts" | "discount";
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

  // ── 多師傅同單：金額確認狀態 + 收款人歸屬 ──
  // 我可確認的品項（未標記不服務）：指派給我的、沒指派師傅的(現場師傅兜底)；
  // 老闆娘/manager 檢視時可確認整單(避免有品項沒人能確認 → 收款閘門卡死)
  const isPrivileged =
    me.profile.role === "owner" || me.profile.role === "manager";
  const myItems = o.items.filter(
    (it) =>
      !it.excluded &&
      (isPrivileged || it.technician_id === me.id || it.technician_id === null),
  );
  const hasMyItems = myItems.length > 0;
  // 我這邊是否都確認了（沒有負責品項也視為 OK）
  const myConfirmed = myItems.every((it) => it.confirmed);
  // 收款閘門：整單所有未排除品項皆已確認。
  // 注意：當「沒有任何未排除品項」時(例：唯一機器拆解後標記不服務、只收 300 拆解費)，
  // 沒有金額要確認 → 閘門必須直接放行；若要求 length>0 會讓收款/完成鈕永遠卡死(灰字)。
  const activeItems = o.items.filter((it) => !it.excluded);
  const allConfirmed = activeItems.every((it) => it.confirmed);
  const iAmCollector = o.collected_by_technician_id === me.id;

  // 已被別人收款時，查收款師傅名字（顯示「已由 X 收取」）
  let collectorName: string | null = null;
  if (o.collected_by_technician_id && !iAmCollector) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data: c } = await createAdminClient()
      .from("user_profiles")
      .select("name")
      .eq("id", o.collected_by_technician_id)
      .maybeSingle();
    collectorName = (c as { name: string } | null)?.name ?? "其他師傅";
  }

  return (
    <div className="p-4 space-y-3">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-zinc-500"
      >
        <ChevronLeft className="h-4 w-4" /> {previewing ? "回預覽" : "回今日案件"}
      </Link>

      {previewing && (
        <div className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-center text-sm text-indigo-800">
          👁 預覽唯讀：正在檢視其他師傅的訂單，只能看不能操作（收款 / 改機型 / 加減項皆由該師傅本人或老闆娘處理）
        </div>
      )}

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
        <CardBody className="space-y-2 p-3">
          <ul className="space-y-2">
            {o.items.map((it) => {
              const frame =
                (it.service?.category && CATEGORY_FRAME[it.service.category]) ||
                null;
              return (
              <li
                key={it.id}
                className={`space-y-1.5 rounded-lg border-4 px-3 py-3 ${
                  frame ? frame.border : "border-zinc-200"
                } ${it.excluded ? "bg-zinc-50" : ""}`}
              >
                {frame && (
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${frame.chip}`}
                  >
                    {frame.label}
                  </span>
                )}
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
                {/* 案件完成後鎖定品項編輯（換品項/不服務/機器）——師傅不可再改。
                    預覽模式：隱藏不服務/換品項，機器資訊仍顯示但唯讀。 */}
                {o.status !== "done" && !previewing && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <UndismantledToggle
                        orderId={o.id}
                        orderItemId={it.id}
                        undismantled={it.undismantled}
                      />
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
                  </>
                )}
                {o.status !== "done" && (
                  <MachineEditor
                    orderId={o.id}
                    orderItemId={it.id}
                    customerId={o.customer_id}
                    serviceCategory={it.service?.category ?? null}
                    machine={it.machine}
                    brands={brands}
                    readOnly={previewing}
                  />
                )}
              </li>
              );
            })}
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
                  <span>{p.service_at ? formatTaiwanDate(p.service_at) : ""}</span>
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
          excluded: it.excluded,
          unit_price: Number(it.unit_price),
        }))}
        initialAdjustments={o.adjustments}
        adjustmentItems={adjustmentItems}
        presets={presets}
        initialTags={o.service_tags ?? []}
        initialNotes={o.service_notes ?? ""}
        promotionTypes={promotionTypes}
        initialPromotions={myPromotions}
        myUserId={me.id}
        myConfirmed={myConfirmed}
        hasMyItems={hasMyItems}
        allConfirmed={allConfirmed}
        iAmCollector={iAmCollector}
        collectorName={collectorName}
        readOnly={previewing}
      />
    </div>
  );
}
