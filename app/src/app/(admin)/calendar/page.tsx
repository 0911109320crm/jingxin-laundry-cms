import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import {
  CalendarView,
  type CalendarOrder,
  type CalendarLeave,
} from "./CalendarView";
import { PendingPanel, type PendingOrder } from "./PendingPanel";
import { TechTabs, type TechOption } from "./TechTabs";

type SP = Promise<{ tech?: string }>;

type ScheduledRaw = {
  id: string;
  order_code: string;
  scheduled_at: string;
  scheduled_end_at: string | null;
  status: CalendarOrder["status"];
  total: number;
  customer: { name: string; phone: string } | null;
  address: { county: string; district: string; address: string } | null;
  items: {
    technician_id: string | null;
    service: { name: string } | null;
  }[];
};

type PendingRaw = {
  id: string;
  order_code: string;
  total: number;
  scheduled_at: string | null;
  scheduled_end_at: string | null;
  duration_minutes: number | null;
  customer: {
    name: string;
    phone: string;
    phones: { id: string; phone: string; label: string | null; is_primary: boolean }[];
  } | null;
  address: {
    county: string;
    district: string;
    address: string;
  } | null;
  items: {
    technician_id: string | null;
    service: { name: string } | null;
  }[];
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await requireRole(["owner", "manager"]);
  const sp = await searchParams;

  const supabase = await createClient();
  const admin = createAdminClient();

  // 月曆只載「近期」訂單（前 2 個月 ~ 後 4 個月），避免把上萬筆歷史完工單全部丟給
  // FullCalendar 導致卡死/排案看不到。要看更早歷史請用「訂單」頁。
  const calWinStart = new Date();
  calWinStart.setMonth(calWinStart.getMonth() - 2);
  const calWinEnd = new Date();
  calWinEnd.setMonth(calWinEnd.getMonth() + 4);

  const calWinStartDate = calWinStart.toISOString().slice(0, 10);
  const calWinEndDate = calWinEnd.toISOString().slice(0, 10);

  const [
    { data: techsRaw },
    { data: scheduledRaw },
    { data: pendingRaw },
    { data: leavesRaw },
  ] = await Promise.all([
    admin
      .from("user_profiles")
      .select("id, name")
      .eq("active", true)
      .eq("role", "technician")
      .order("name"),
    supabase
      .from("orders")
      .select(
        `id, order_code, scheduled_at, scheduled_end_at, status, total,
         customer:customers(name, phone),
         address:customer_addresses(county, district, address),
         items:order_items(technician_id, service:service_items(name))`,
      )
      .not("scheduled_at", "is", null)
      .not("status", "in", "(pending,cancelled)")
      .gte("scheduled_at", calWinStart.toISOString())
      .lte("scheduled_at", calWinEnd.toISOString())
      .order("scheduled_at"),
    supabase
      .from("orders")
      .select(
        `id, order_code, total, scheduled_at, scheduled_end_at, duration_minutes,
         customer:customers(name, phone,
                            phones:customer_phones(id, phone, label, is_primary)),
         address:customer_addresses(county, district, address),
         items:order_items(technician_id, service:service_items(name))`,
      )
      .eq("status", "pending")
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    // 休假（月曆視窗內）：全部師傅一起撈，下方再依 techFilter 過濾
    supabase
      .from("technician_leave")
      .select("id, technician_id, leave_date, period")
      .gte("leave_date", calWinStartDate)
      .lte("leave_date", calWinEndDate),
  ]);

  const techs = (techsRaw as TechOption[] | null) ?? [];
  const technicianIds = techs.map((t) => t.id);
  const nameMap = new Map(techs.map((t) => [t.id, t.name]));

  // tab：「休假列表」(leave) 或 特定師傅。預設第一位師傅(原「全部師傅」已移除)。
  const techFilter =
    sp.tech && (sp.tech === "leave" || techs.some((t) => t.id === sp.tech))
      ? sp.tech
      : techs[0]?.id ?? "leave";
  const isLeaveView = techFilter === "leave";

  // 休假列表模式：完全不顯示訂單，只看全體休假。否則只顯示該師傅的訂單。
  let scheduledFiltered = isLeaveView
    ? []
    : (scheduledRaw as ScheduledRaw[] | null) ?? [];
  if (!isLeaveView) {
    scheduledFiltered = scheduledFiltered.filter((o) =>
      o.items.some((it) => it.technician_id === techFilter),
    );
  }

  // 休假：全部 view 顯示所有師傅；指定師傅只顯示他的。帶上師傅名供月曆標示。
  type LeaveRaw = {
    id: string;
    technician_id: string;
    leave_date: string;
    period: "full" | "am" | "pm";
  };
  const leaves: CalendarLeave[] = ((leavesRaw as LeaveRaw[] | null) ?? [])
    .filter((lv) => isLeaveView || lv.technician_id === techFilter)
    .map((lv) => ({
      id: lv.id,
      date: lv.leave_date,
      period: lv.period,
      technician_id: lv.technician_id,
      technician_name: nameMap.get(lv.technician_id) ?? "師傅",
    }));

  const orders: CalendarOrder[] = scheduledFiltered.map((o) => {
    const techId = o.items.find((it) => it.technician_id)?.technician_id ?? null;
    const services = o.items
      .map((it) => it.service?.name)
      .filter(Boolean) as string[];
    const area = o.address
      ? `${o.address.county}${o.address.district}`
      : null;
    return {
      id: o.id,
      order_code: o.order_code,
      scheduled_at: o.scheduled_at,
      scheduled_end_at: o.scheduled_end_at,
      status: o.status,
      total: Number(o.total),
      customer_name: o.customer?.name ?? "—",
      customer_phone: o.customer?.phone ?? null,
      area,
      full_address: o.address
        ? `${o.address.county} ${o.address.district} ${o.address.address}`
        : null,
      service_summary: services.join("、"),
      technician_id: techId,
      technician_name: techId ? nameMap.get(techId) ?? null : null,
    };
  });

  const pending: PendingOrder[] = ((pendingRaw as PendingRaw[] | null) ?? []).map(
    (o) => {
      const services = o.items
        .map((it) => it.service?.name)
        .filter(Boolean) as string[];
      return {
        id: o.id,
        order_code: o.order_code,
        customer_name: o.customer?.name ?? "—",
        customer_phone: o.customer?.phone ?? "—",
        customer_phones: o.customer?.phones ?? undefined,
        address: o.address
          ? `${o.address.county} ${o.address.district} ${o.address.address}`
          : "—",
        service_summary:
          services.length > 0
            ? `${services.length} 項：${services.join("、")}`
            : "未填服務",
        total: Number(o.total),
        has_technician: o.items.some((it) => it.technician_id),
        scheduled_at: o.scheduled_at,
        scheduled_end_at: o.scheduled_end_at,
        duration_minutes: o.duration_minutes ?? 90,
      };
    },
  );

  const subtitle = isLeaveView
    ? "全體師傅休假總覽（此模式不顯示訂單）"
    : nameMap.get(techFilter)
      ? `只顯示「${nameMap.get(techFilter)}」的案件`
      : "尚未建立任何師傅";

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">
          {isLeaveView ? "休假列表" : "月曆排案"}
        </h1>
        <p className="text-sm text-zinc-500">{subtitle}</p>
      </header>

      <div
        className={
          isLeaveView
            ? "grid grid-cols-1 gap-4"
            : "grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]"
        }
      >
        {!isLeaveView && <PendingPanel orders={pending} />}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
          <TechTabs current={techFilter} techs={techs} />
          {isLeaveView && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              🏖 目前是「休假列表」模式，只顯示各師傅休假；要看／排訂單請切到上方某位師傅。
            </p>
          )}
          <CalendarView
            orders={orders}
            leaves={leaves}
            technicianIds={technicianIds}
            techFilter={techFilter}
          />
        </div>
      </div>
    </div>
  );
}
