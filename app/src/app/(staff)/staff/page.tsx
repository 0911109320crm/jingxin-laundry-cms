import Link from "next/link";
import { CalendarDays, MapPin, ChevronRight, Star, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import {
  PaymentBadge,
  StatusBadge,
  SettlementBadge,
} from "@/components/orders/StatusBadges";
import { formatNTD } from "@/lib/utils";
import type { OrderInput } from "@/lib/validators/order";

type StaffOrder = {
  id: string;
  order_code: string;
  scheduled_at: string;
  status: OrderInput["status"];
  payment_method: OrderInput["payment_method"];
  settlement_status: "pending" | "settled" | "not_required";
  total: number;
  customer: {
    name: string;
    phone: string;
    phones: { id: string; phone: string; label: string | null; is_primary: boolean }[];
  } | null;
  address: { county: string; district: string; address: string } | null;
  items: { quantity: number; service: { name: string } | null }[];
};

// 用台灣時區把 ISO 轉成 yyyy-mm-dd，避免跨日邊界誤判
const TW_DATE_FMT = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Taipei",
});

// 預約時間一律用台灣時區顯示（伺服器在 UTC，不可用 getHours()）
const TW_TIME_FMT = new Intl.DateTimeFormat("zh-TW", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Taipei",
});

function taiwanDateKey(iso: string): string {
  return TW_DATE_FMT.format(new Date(iso));
}

function formatDateHeader(dateKey: string): { main: string; isToday: boolean; isTomorrow: boolean } {
  const today = TW_DATE_FMT.format(new Date());
  const tomorrowD = new Date();
  tomorrowD.setDate(tomorrowD.getDate() + 1);
  const tomorrow = TW_DATE_FMT.format(tomorrowD);

  const d = new Date(`${dateKey}T00:00:00`);
  const main = new Intl.DateTimeFormat("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(d);

  return {
    main,
    isToday: dateKey === today,
    isTomorrow: dateKey === tomorrow,
  };
}

export default async function StaffHome() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  // 本月積分查詢區間
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  // 顯示範圍：往前 7 天 + 未來所有未完成 (避免載入過多歷史)
  const startWindow = new Date();
  startWindow.setDate(startWindow.getDate() - 7);

  const supabase = await createClient();
  // RLS scopes orders to ones where this user has any order_item
  const [
    { data },
    { data: pendingCashRows },
    { data: myPromosThisMonth },
    { data: kpiRow },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, order_code, scheduled_at, status, payment_method, settlement_status, total,
         customer:customers(name, phone, phones:customer_phones(id, phone, label, is_primary)),
         address:customer_addresses(county, district, address),
         items:order_items(quantity, service:service_items(name))`,
      )
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", startWindow.toISOString())
      .not("status", "in", "(cancelled)")
      .order("scheduled_at"),
    // 只算「我收的現金」：collected_by=我，或舊資料(null)回退（RLS 已限定我有參與的單）
    supabase
      .from("orders")
      .select("total")
      .eq("payment_method", "cash")
      .eq("settlement_status", "pending")
      .or(
        `collected_by_technician_id.eq.${me.id},collected_by_technician_id.is.null`,
      ),
    supabase
      .from("order_promotions")
      .select("points_snapshot")
      .eq("credited_to", me.id)
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd),
    supabase
      .from("system_settings")
      .select("value")
      .eq("key", "monthly_promotion_kpi")
      .maybeSingle(),
  ]);

  const myPoints = ((myPromosThisMonth as { points_snapshot: number }[] | null) ?? [])
    .reduce((s, r) => s + r.points_snapshot, 0);
  const kpi = typeof kpiRow?.value === "number" ? kpiRow.value : 30;
  const kpiPct = Math.min(100, Math.round((myPoints / Math.max(1, kpi)) * 100));
  const kpiAchieved = myPoints >= kpi;

  const orders = (data as StaffOrder[] | null) ?? [];
  const pendingCashTotal =
    ((pendingCashRows as { total: number }[] | null) ?? []).reduce(
      (s, o) => s + Number(o.total),
      0,
    );
  const pendingCashCount = (pendingCashRows as unknown[] | null)?.length ?? 0;

  // 依台灣日期 group orders（已 ORDER BY scheduled_at ASC）
  const groups: { dateKey: string; orders: StaffOrder[] }[] = [];
  for (const o of orders) {
    const key = taiwanDateKey(o.scheduled_at);
    const last = groups[groups.length - 1];
    if (last && last.dateKey === key) last.orders.push(o);
    else groups.push({ dateKey: key, orders: [o] });
  }

  return (
    <div className="p-4 space-y-4">
      {me.profile.can_view_all && (
        <Link href="/staff/all">
          <Card className="border-sky-300 bg-sky-50 transition-shadow active:shadow-md">
            <CardBody className="flex items-center justify-between gap-2 py-3">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-sky-600" />
                <span className="text-sm font-medium text-sky-900">
                  查看所有師傅排班
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-sky-400" />
            </CardBody>
          </Card>
        </Link>
      )}

      {pendingCashCount > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardBody className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-amber-700">您手上待回繳現金</p>
              <p className="text-xs text-amber-600">{pendingCashCount} 筆訂單</p>
            </div>
            <p className="shrink-0 text-2xl font-bold text-amber-800 font-mono">
              NT$ {pendingCashTotal.toLocaleString()}
            </p>
          </CardBody>
        </Card>
      )}

      <Link href="/staff/scores">
        <Card
          className={
            kpiAchieved
              ? "border-green-300 bg-gradient-to-r from-green-50 to-emerald-100 transition-shadow active:shadow-md"
              : "border-zinc-200 bg-white transition-shadow active:shadow-md"
          }
        >
          <CardBody className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star
                  className={
                    kpiAchieved
                      ? "h-5 w-5 fill-green-500 text-green-500"
                      : "h-5 w-5 text-amber-500"
                  }
                />
                <span className="text-sm font-medium text-zinc-800">
                  本月積分 · KPI {kpi} 分
                </span>
              </div>
              <span
                className={
                  kpiAchieved
                    ? "font-mono text-2xl font-bold text-green-700"
                    : "font-mono text-2xl font-bold text-amber-700"
                }
              >
                {myPoints}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={kpiAchieved ? "h-full bg-green-500" : "h-full bg-amber-500"}
                style={{ width: `${kpiPct}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500">
              {kpiAchieved ? "🎉 本月已達標" : `還差 ${kpi - myPoints} 分達標 · 點擊查看詳情`}
            </p>
          </CardBody>
        </Card>
      </Link>

      {groups.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-12">
            <CalendarDays className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">近期沒有案件</p>
            <p className="text-xs text-zinc-400">（顯示 7 天前到未來所有未取消）</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map(({ dateKey, orders: groupOrders }) => {
            const { main, isToday, isTomorrow } = formatDateHeader(dateKey);
            return (
              <section key={dateKey} className="space-y-2">
                {/* 日期分隔列 */}
                <div className="sticky top-0 z-10 -mx-4 border-y border-zinc-200 bg-zinc-100 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-800">{main}</span>
                    {isToday && (
                      <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        今天
                      </span>
                    )}
                    {isTomorrow && (
                      <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        明天
                      </span>
                    )}
                    <span className="ml-auto text-xs text-zinc-500">
                      {groupOrders.length} 件
                    </span>
                  </div>
                </div>

                <ul className="space-y-2">
                  {groupOrders.map((o) => {
                    const time = TW_TIME_FMT.format(new Date(o.scheduled_at));
                    return (
                      <li key={o.id}>
                        <Link href={`/staff/order/${o.id}`}>
                          <Card className="transition-shadow active:shadow-md">
                            <CardBody className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-bold text-zinc-900">
                                    {time}
                                  </span>
                                  <span className="font-mono text-xs text-zinc-400">
                                    {o.order_code}
                                  </span>
                                </div>
                                <ChevronRight className="h-5 w-5 text-zinc-400" />
                              </div>
                              <div>
                                <p className="text-base font-semibold text-zinc-900">
                                  {o.customer?.name ?? "—"}
                                </p>
                                <p className="text-sm text-zinc-500">
                                  {o.customer?.phone}
                                  {o.customer?.phones && o.customer.phones.length > 1 && (
                                    <span
                                      className="ml-1 rounded bg-zinc-100 px-1 text-[10px] text-zinc-600"
                                      title={o.customer.phones
                                        .filter((p) => !p.is_primary)
                                        .map((p) => `${p.phone}${p.label ? `（${p.label}）` : ""}`)
                                        .join("、")}
                                    >
                                      +{o.customer.phones.length - 1}
                                    </span>
                                  )}
                                </p>
                              </div>
                              {o.items.length > 0 && (
                                <p className="text-sm text-zinc-700">
                                  {o.items
                                    .map((it) =>
                                      it.service?.name
                                        ? `${it.service.name}${it.quantity > 1 ? `×${it.quantity}` : ""}`
                                        : null,
                                    )
                                    .filter(Boolean)
                                    .join("、")}
                                </p>
                              )}
                              {o.address && (
                                <p className="flex items-start gap-1 text-sm text-zinc-600">
                                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                  <span>
                                    {o.address.county} {o.address.district}{" "}
                                    {o.address.address}
                                  </span>
                                </p>
                              )}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <div className="flex flex-wrap gap-1">
                                  <StatusBadge value={o.status} />
                                  <PaymentBadge value={o.payment_method} />
                                  {o.settlement_status !== "not_required" && (
                                    <SettlementBadge value={o.settlement_status} />
                                  )}
                                </div>
                                <span className="font-mono text-base font-semibold text-zinc-900">
                                  {formatNTD(o.total)}
                                </span>
                              </div>
                            </CardBody>
                          </Card>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
