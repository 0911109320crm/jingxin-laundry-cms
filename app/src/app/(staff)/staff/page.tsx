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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STAFF_ORDER_SELECT = `id, order_code, scheduled_at, status, payment_method, settlement_status, total,
         customer:customers(name, phone, phones:customer_phones(id, phone, label, is_primary)),
         address:customer_addresses(county, district, address),
         items:order_items(quantity, service:service_items(name))`;

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

export default async function StaffHome({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  // ── 老闆娘 / RC 預覽某師傅 PWA：?as=<techId> ──
  // 防越權：是否能以他人身份預覽，完全由「真實登入者的角色」決定，不信任網址參數。
  const sp = await searchParams;
  const isPrivileged =
    me.profile.role === "owner" ||
    me.profile.role === "manager" ||
    Boolean(me.profile.can_view_all);
  const asId =
    typeof sp.as === "string" && UUID_RE.test(sp.as) ? sp.as : null;
  const impersonating = !!asId && isPrivileged && asId !== me.id;
  const targetId = impersonating ? asId! : me.id;
  let previewName: string | null = null;

  // 本月積分查詢區間
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  // 顯示範圍：往前 7 天 + 未來所有未完成 (避免載入過多歷史)
  const startWindow = new Date();
  startWindow.setDate(startWindow.getDate() - 7);

  let orders: StaffOrder[] = [];
  let pendingCashRows: { total: number }[] = [];
  let myPromosThisMonth: { points_snapshot: number }[] = [];
  let kpiRow: { value: unknown } | null = null;

  if (impersonating) {
    // 預覽模式：用 admin client 繞過 RLS，但明確以該師傅的 technician_id 過濾
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    const [{ data: nameRow }, { data: itemRows }] = await Promise.all([
      admin.from("user_profiles").select("name").eq("id", targetId).maybeSingle(),
      admin.from("order_items").select("order_id").eq("technician_id", targetId),
    ]);
    previewName = (nameRow as { name: string } | null)?.name ?? "該師傅";
    const orderIds = [
      ...new Set(
        ((itemRows as { order_id: string }[] | null) ?? []).map((r) => r.order_id),
      ),
    ];

    const [ord, cash, promos, kpiQ] = await Promise.all([
      orderIds.length
        ? admin
            .from("orders")
            .select(STAFF_ORDER_SELECT)
            .in("id", orderIds)
            .not("scheduled_at", "is", null)
            .gte("scheduled_at", startWindow.toISOString())
            .not("status", "in", "(cancelled)")
            .order("scheduled_at")
        : Promise.resolve({ data: [] as unknown }),
      admin
        .from("orders")
        .select("total")
        .eq("payment_method", "cash")
        .eq("settlement_status", "pending")
        .eq("collected_by_technician_id", targetId),
      admin
        .from("order_promotions")
        .select("points_snapshot")
        .eq("credited_to", targetId)
        .gte("created_at", monthStart)
        .lt("created_at", monthEnd),
      admin
        .from("system_settings")
        .select("value")
        .eq("key", "monthly_promotion_kpi")
        .maybeSingle(),
    ]);
    orders = ((ord as { data: unknown }).data as StaffOrder[] | null) ?? [];
    pendingCashRows = (cash.data as { total: number }[] | null) ?? [];
    myPromosThisMonth = (promos.data as { points_snapshot: number }[] | null) ?? [];
    kpiRow = (kpiQ.data as { value: unknown } | null) ?? null;
  } else {
    const supabase = await createClient();
    // RLS scopes orders to ones where this user has any order_item
    const [a, b, c, d] = await Promise.all([
      supabase
        .from("orders")
        .select(STAFF_ORDER_SELECT)
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
    orders = (a.data as StaffOrder[] | null) ?? [];
    pendingCashRows = (b.data as { total: number }[] | null) ?? [];
    myPromosThisMonth = (c.data as { points_snapshot: number }[] | null) ?? [];
    kpiRow = (d.data as { value: unknown } | null) ?? null;
  }

  const myPoints = myPromosThisMonth.reduce((s, r) => s + r.points_snapshot, 0);
  const kpi = typeof kpiRow?.value === "number" ? kpiRow.value : 30;
  const kpiPct = Math.min(100, Math.round((myPoints / Math.max(1, kpi)) * 100));
  const kpiAchieved = myPoints >= kpi;

  const pendingCashTotal = pendingCashRows.reduce(
    (s, o) => s + Number(o.total),
    0,
  );
  const pendingCashCount = pendingCashRows.length;

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
      {impersonating && (
        <div className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-center text-sm text-indigo-800">
          👁 預覽模式：正在以「{previewName}」的身份檢視（唯讀預覽，師傅實際操作請各自登入）
        </div>
      )}

      {!impersonating && me.profile.can_view_all && (
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
                            <CardBody className="space-y-1.5 p-3">
                              {/* 第一列：時間+編號(左) ／ 金額+箭頭(右，填補右上留白) */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-baseline gap-2">
                                  <span className="text-lg font-bold leading-tight text-zinc-900">
                                    {time}
                                  </span>
                                  <span className="truncate font-mono text-xs text-zinc-400">
                                    {o.order_code}
                                  </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <span className="font-mono text-lg font-bold leading-tight text-zinc-900">
                                    {formatNTD(o.total)}
                                  </span>
                                  <ChevronRight className="h-5 w-5 text-zinc-400" />
                                </div>
                              </div>

                              {/* 第二列：姓名 + 電話 同一行 */}
                              <p className="truncate text-sm text-zinc-900">
                                <span className="text-base font-semibold">
                                  {o.customer?.name ?? "—"}
                                </span>
                                {o.customer?.phone && (
                                  <span className="ml-2 font-normal text-zinc-500">
                                    {o.customer.phone}
                                  </span>
                                )}
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

                              {o.items.length > 0 && (
                                <p className="truncate text-sm text-zinc-700">
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

                              {/* 地址：一整行不斷行 */}
                              {o.address && (
                                <p className="flex items-center gap-1 text-sm text-zinc-600">
                                  <MapPin className="h-4 w-4 shrink-0 text-zinc-400" />
                                  <span className="whitespace-nowrap">
                                    {o.address.county}
                                    {o.address.district}
                                    {o.address.address}
                                  </span>
                                </p>
                              )}

                              {/* 徽章列（金額已移到上方，這裡只留狀態） */}
                              <div className="flex flex-wrap gap-1">
                                <StatusBadge value={o.status} />
                                <PaymentBadge value={o.payment_method} />
                                {o.settlement_status !== "not_required" && (
                                  <SettlementBadge value={o.settlement_status} />
                                )}
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
