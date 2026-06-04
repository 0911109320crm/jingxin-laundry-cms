import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { MonthBoard, type DayCell, type TechOpt } from "./MonthBoard";

type SP = Promise<{ tech?: string; month?: string }>;

const TW = "Asia/Taipei";
// 取得某 ISO 時間在台灣時區的 { dateKey:'YYYY-MM-DD', hour, minute }
function twParts(iso: string) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TW,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  let hour = g("hour");
  if (hour === "24") hour = "00";
  return {
    dateKey: `${g("year")}-${g("month")}-${g("day")}`,
    minuteOfDay: Number(hour) * 60 + Number(g("minute")),
    label: `${hour}:${g("minute")}`,
  };
}
const NOON = 12 * 60;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export default async function CalendarMonthPage({ searchParams }: { searchParams: SP }) {
  await requireRole(["owner", "manager"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

  // 師傅清單
  const { data: techsRaw } = await admin
    .from("user_profiles")
    .select("id, name")
    .eq("active", true)
    .eq("role", "technician")
    .order("name");
  const techs = (techsRaw as TechOpt[] | null) ?? [];

  const selectedTech =
    sp.tech && techs.some((t) => t.id === sp.tech) ? sp.tech : techs[0]?.id ?? null;

  // 當月（台灣時區）；sp.month = 'YYYY-MM'
  const nowYm = new Intl.DateTimeFormat("en-CA", {
    timeZone: TW,
    year: "numeric",
    month: "2-digit",
  }).format(new Date()); // 'YYYY-MM'
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? (sp.month as string) : nowYm;
  const [yy, mm] = month.split("-").map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate(); // mm 為 1-based → 下月第 0 天
  const nextYm =
    mm === 12 ? `${yy + 1}-01` : `${yy}-${String(mm + 1).padStart(2, "0")}`;
  const monthStartIso = `${month}-01T00:00:00+08:00`;
  const nextMonthStartIso = `${nextYm}-01T00:00:00+08:00`;
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: TW,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // 準備空的每日格子
  const cells: DayCell[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${month}-${String(d).padStart(2, "0")}`;
    // 以台灣正午判斷星期，避開跨時區日界問題
    const wd = new Intl.DateTimeFormat("en-US", {
      timeZone: TW,
      weekday: "short",
    }).format(new Date(`${dateKey}T12:00:00+08:00`));
    const wdIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
    cells.push({
      date: dateKey,
      dayNum: d,
      weekday: WEEKDAYS[wdIdx] ?? "",
      isToday: dateKey === todayKey,
      isWeekend: wdIdx === 0 || wdIdx === 6,
      assignments: [],
      amBusy: false,
      pmBusy: false,
      leave: null,
    });
  }
  const cellByDate = new Map(cells.map((c) => [c.date, c]));

  if (selectedTech) {
    const [{ data: ordersRaw }, { data: leavesRaw }] = await Promise.all([
      supabase
        .from("orders")
        .select(
          `id, order_code, scheduled_at, status, duration_minutes,
           customer:customers(name),
           address:customer_addresses(county, district),
           items:order_items(technician_id, service:service_items(name))`,
        )
        .gte("scheduled_at", monthStartIso)
        .lt("scheduled_at", nextMonthStartIso)
        .neq("status", "cancelled")
        .order("scheduled_at"),
      supabase
        .from("technician_leave")
        .select("leave_date, period")
        .eq("technician_id", selectedTech)
        .gte("leave_date", `${month}-01`)
        .lt("leave_date", `${nextYm}-01`),
    ]);

    type OrderRaw = {
      id: string;
      order_code: string;
      scheduled_at: string;
      status: string;
      duration_minutes: number | null;
      customer: { name: string } | null;
      address: { county: string; district: string } | null;
      items: { technician_id: string | null; service: { name: string } | null }[];
    };
    for (const o of (ordersRaw as OrderRaw[] | null) ?? []) {
      // 只取「該師傅有負責任何一項」的訂單
      if (!o.items.some((it) => it.technician_id === selectedTech)) continue;
      const { dateKey, minuteOfDay, label } = twParts(o.scheduled_at);
      const cell = cellByDate.get(dateKey);
      if (!cell) continue;
      const services = Array.from(
        new Set(o.items.map((it) => it.service?.name).filter(Boolean) as string[]),
      );
      cell.assignments.push({
        orderId: o.id,
        timeLabel: label,
        customerName: o.customer?.name ?? "—",
        services: services.join("、") || "未填項目",
        area: o.address ? `${o.address.county}${o.address.district}` : "—",
        status: o.status,
      });
      // 以「開始 ~ 開始+時長」的區間判定上下午佔用（跨午的單會同時佔上午與下午）
      const startMin = minuteOfDay;
      const endMin = startMin + (o.duration_minutes ?? 90);
      if (startMin < NOON) cell.amBusy = true;
      if (endMin > NOON) cell.pmBusy = true;
    }

    for (const lv of (leavesRaw as { leave_date: string; period: string }[] | null) ?? []) {
      const cell = cellByDate.get(lv.leave_date);
      if (!cell) continue;
      // full 優先；否則合併 am/pm（兩者都有 → 視為 full 顯示）
      if (lv.period === "full") cell.leave = "full";
      else if (cell.leave !== "full") {
        cell.leave =
          cell.leave && cell.leave !== lv.period ? "full" : (lv.period as "am" | "pm");
      }
    }
  }

  const prevYm =
    mm === 1 ? `${yy - 1}-12` : `${yy}-${String(mm - 1).padStart(2, "0")}`;
  const techParam = selectedTech ? `&tech=${selectedTech}` : "";

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Link
        href="/calendar"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ChevronLeft className="h-4 w-4" /> 回月曆排案（桌機拖曳）
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">班表檢視</h1>
        <p className="text-sm text-zinc-500">
          一頁看某位師傅整個月的派案與空檔，可直接設定休假。
        </p>
      </header>

      {techs.length === 0 ? (
        <p className="text-sm text-zinc-500">尚未建立任何師傅帳號。</p>
      ) : (
        <MonthBoard
          techs={techs}
          selectedTech={selectedTech!}
          month={month}
          prevMonth={prevYm}
          nextMonth={nextYm}
          monthLabel={`${yy} 年 ${mm} 月`}
          days={cells}
          techParam={techParam}
        />
      )}
    </div>
  );
}
