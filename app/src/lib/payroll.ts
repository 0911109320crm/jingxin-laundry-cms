import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { taipeiMonthRange, taipeiDateStr } from "@/lib/timezone";

/**
 * 算台數薪資模型（老闆娘 2026-06-10 版，取代舊的百分比抽成）。
 *
 *   本薪      固定 base_salary，未達 base_units 台仍領滿
 *   台數獎金  第 (base_units+1) 台起，每台 overage_unit_rate
 *   技術獎金  每台機型加給 = service_items.unit_bonus；未拆解每台 +undismantled_bonus
 *   全勤      當月無休假登記 → +full_attendance_bonus
 *   伙食津貼  meal_base + 出勤日 × meal_per_day
 *   行銷獎金  打卡積分超過 marketing_threshold 後，每多 1 分 +marketing_per_point
 *   維修/執行/浮動  走 payroll_adjustments（bonus/deduction）手動加減
 *
 * 台數 = 當月該師傅 order_items 筆數（排除 excluded / cancelled，一台機器一筆）。
 * 月份與分日一律用台灣時區（scheduled_at），修掉 UTC server 凌晨歸錯月/日的問題。
 */

export type PayrollConstants = {
  base_salary: number;
  base_units: number;
  overage_unit_rate: number;
  undismantled_bonus: number;
  full_attendance_bonus: number;
  meal_base: number;
  meal_per_day: number;
  marketing_threshold: number;
  marketing_per_point: number;
};

const DEFAULT_CONSTANTS: PayrollConstants = {
  base_salary: 29900,
  base_units: 65,
  overage_unit_rate: 520,
  undismantled_bonus: 100,
  full_attendance_bonus: 2000,
  meal_base: 1200,
  meal_per_day: 50,
  marketing_threshold: 30,
  marketing_per_point: 10,
};

/** 技術獎金的一行明細（依品項/未拆解分組）。 */
export type MachineBonusLine = {
  label: string;
  count: number;
  rate: number;
  subtotal: number;
};

export type PayrollItem = {
  id: string;
  order_id: string;
  order_code: string;
  customer_name: string;
  customer_code: string;
  service_name: string | null;
  category: string | null;
  /** 該台的機型技術獎金（service_items.unit_bonus） */
  unit_bonus: number;
  /** 是否未拆解（另計 undismantled_bonus） */
  undismantled: boolean;
  payment_method: string;
};

export type DailyRow = {
  day: number;
  date: string; // YYYY-MM-DD
  items: PayrollItem[];
  /** 該日台數 */
  dayUnits: number;
  /** 該日技術獎金（unit_bonus + 未拆解） */
  dayBonus: number;
};

export type PayrollMonthlyAdj = {
  id: string;
  type: "bonus" | "deduction";
  amount: number;
  reason: string;
  created_at: string;
};

export type PayrollData = {
  technician: { id: string; name: string };
  year: number;
  month: number;
  rows: DailyRow[];
  /** 總台數 */
  unitCount: number;
  /** 本薪（保底） */
  baseSalary: number;
  /** 本薪內含台數 */
  baseUnits: number;
  /** 超額台數（第 base_units+1 台起） */
  overageUnits: number;
  /** 台數獎金 */
  overageBonus: number;
  /** 技術獎金合計 */
  machineBonus: number;
  /** 技術獎金明細（品項分組 + 未拆解） */
  machineBonusLines: MachineBonusLine[];
  /** 出勤日（當月有派案的不重複台北日期數） */
  attendanceDays: number;
  /** 當月休假登記天數（判全勤依據） */
  leaveDays: number;
  /** 是否全勤 */
  fullAttendance: boolean;
  /** 全勤獎金 */
  attendanceBonus: number;
  /** 伙食津貼 */
  mealAllowance: number;
  /** 本月打卡積分 */
  marketingPoints: number;
  /** 行銷獎金 */
  marketingBonus: number;
  /** 月度手動加減（維修/執行/浮動） */
  monthlyAdjustments: PayrollMonthlyAdj[];
  /** 加項合計 */
  monthBonus: number;
  /** 扣項合計 */
  monthDeduction: number;
  /** 應發合計 */
  monthTotal: number;
  /** = unitCount，給總覽頁沿用 */
  totalItems: number;
  /** 費率常數（UI 顯示用） */
  constants: PayrollConstants;
  /** 該月是否已 snapshot 鎖定 */
  finalized: boolean;
};

export async function fetchPayroll(
  technicianId: string,
  monthStr: string, // "YYYY-MM"
): Promise<PayrollData | null> {
  const range = taipeiMonthRange(monthStr);
  if (!range) return null;
  const [y, m] = monthStr.split("-").map(Number);
  const { startIso, endIso } = range;

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, name")
    .eq("id", technicianId)
    .single();
  const tech = profile as { id: string; name: string } | null;
  if (!tech) return null;

  const [
    { data: itemsRaw },
    { data: settingRow },
    { data: adjustmentsRaw },
    { data: promosRaw },
    { data: leavesRaw },
    { data: snapshotRow },
  ] = await Promise.all([
    admin
      .from("order_items")
      .select(
        `id, order_id, undismantled, technician_id,
         service:service_items(name, category, unit_bonus),
         order:orders(order_code, status, service_at, scheduled_at, payment_method,
                      customer:customers(name, code))`,
      )
      .eq("technician_id", technicianId)
      .eq("excluded", false)
      .gte("orders.scheduled_at", startIso)
      .lt("orders.scheduled_at", endIso),
    admin
      .from("system_settings")
      .select("value")
      .eq("key", "payroll_v2")
      .maybeSingle(),
    admin
      .from("payroll_adjustments")
      .select("id, type, amount, reason, created_at")
      .eq("technician_id", technicianId)
      .eq("month", monthStr)
      .order("created_at", { ascending: false }),
    admin
      .from("order_promotions")
      .select("points_snapshot")
      .eq("credited_to", technicianId)
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    admin
      .from("technician_leave")
      .select("leave_date")
      .eq("technician_id", technicianId)
      .gte("leave_date", taipeiDateStr(startIso))
      .lt("leave_date", taipeiDateStr(endIso)),
    admin
      .from("payroll_snapshots")
      .select("breakdown")
      .eq("technician_id", technicianId)
      .eq("month", monthStr)
      .maybeSingle(),
  ]);

  // 已結算：直接讀 snapshot（freeze 歷史薪資）
  if (snapshotRow?.breakdown) {
    const b = snapshotRow.breakdown as Omit<
      PayrollData,
      "technician" | "year" | "month" | "finalized"
    >;
    return {
      ...b,
      technician: tech,
      year: y,
      month: m,
      finalized: true,
    };
  }

  const constants: PayrollConstants = {
    ...DEFAULT_CONSTANTS,
    ...((settingRow?.value as Partial<PayrollConstants> | null) ?? {}),
  };

  type Raw = {
    id: string;
    order_id: string;
    undismantled: boolean;
    service: {
      name: string;
      category: string | null;
      unit_bonus: number;
    } | null;
    order: {
      order_code: string;
      status: string;
      service_at: string | null;
      scheduled_at: string | null;
      payment_method: string;
      customer: { name: string; code: string } | null;
    } | null;
  };

  const items = (itemsRaw as Raw[] | null) ?? [];

  // 建立每日列
  const byDay = new Map<number, DailyRow>();
  let unitCount = 0;
  let machineBonus = 0;
  // 技術獎金分組：品項名 → {count, rate}；未拆解獨立一組
  const bonusGroups = new Map<string, { count: number; rate: number }>();
  let undismantledCount = 0;

  for (const it of items) {
    if (!it.order) continue;
    if (it.order.status === "cancelled") continue;
    const dateStr = taipeiDateStr(it.order.scheduled_at ?? it.order.service_at);
    if (!dateStr) continue;
    const day = Number(dateStr.slice(8, 10));

    let row = byDay.get(day);
    if (!row) {
      row = { day, date: dateStr, items: [], dayUnits: 0, dayBonus: 0 };
      byDay.set(day, row);
    }

    const unitBonus = Number(it.service?.unit_bonus ?? 0);
    const undismantledBonus = it.undismantled ? constants.undismantled_bonus : 0;
    const lineBonus = unitBonus + undismantledBonus;

    unitCount += 1;
    machineBonus += lineBonus;
    row.dayUnits += 1;
    row.dayBonus += lineBonus;
    row.items.push({
      id: it.id,
      order_id: it.order_id,
      order_code: it.order.order_code,
      customer_name: it.order.customer?.name ?? "—",
      customer_code: it.order.customer?.code ?? "",
      service_name: it.service?.name ?? null,
      category: it.service?.category ?? null,
      unit_bonus: unitBonus,
      undismantled: it.undismantled,
      payment_method: it.order.payment_method,
    });

    if (unitBonus > 0) {
      const key = it.service?.name ?? "未分類";
      const g = bonusGroups.get(key) ?? { count: 0, rate: unitBonus };
      g.count += 1;
      bonusGroups.set(key, g);
    }
    if (it.undismantled) undismantledCount += 1;
  }

  const machineBonusLines: MachineBonusLine[] = Array.from(bonusGroups.entries())
    .map(([label, g]) => ({
      label,
      count: g.count,
      rate: g.rate,
      subtotal: g.count * g.rate,
    }))
    .sort((a, b) => b.subtotal - a.subtotal);
  if (undismantledCount > 0) {
    machineBonusLines.push({
      label: "未拆解",
      count: undismantledCount,
      rate: constants.undismantled_bonus,
      subtotal: undismantledCount * constants.undismantled_bonus,
    });
  }

  // 本薪 + 台數獎金
  const baseSalary = constants.base_salary;
  const overageUnits = Math.max(0, unitCount - constants.base_units);
  const overageBonus = overageUnits * constants.overage_unit_rate;

  // 出勤日：當月有派案的不重複台北日期數
  const attendanceDays = byDay.size;

  // 全勤：當月無休假登記
  const leaveDays = (leavesRaw as { leave_date: string }[] | null)?.length ?? 0;
  const fullAttendance = leaveDays === 0;
  const attendanceBonus = fullAttendance ? constants.full_attendance_bonus : 0;

  // 伙食津貼
  const mealAllowance = constants.meal_base + attendanceDays * constants.meal_per_day;

  // 行銷獎金
  const marketingPoints = (
    (promosRaw as { points_snapshot: number }[] | null) ?? []
  ).reduce((s, p) => s + Number(p.points_snapshot), 0);
  const marketingBonus =
    Math.max(0, marketingPoints - constants.marketing_threshold) *
    constants.marketing_per_point;

  // 月度手動加減
  const monthlyAdjustments =
    (adjustmentsRaw as PayrollMonthlyAdj[] | null) ?? [];
  const monthBonus = monthlyAdjustments
    .filter((a) => a.type === "bonus")
    .reduce((s, a) => s + Number(a.amount), 0);
  const monthDeduction = monthlyAdjustments
    .filter((a) => a.type === "deduction")
    .reduce((s, a) => s + Number(a.amount), 0);

  const monthTotal =
    baseSalary +
    overageBonus +
    machineBonus +
    attendanceBonus +
    mealAllowance +
    marketingBonus +
    monthBonus -
    monthDeduction;

  return {
    technician: tech,
    year: y,
    month: m,
    rows: Array.from(byDay.values()).sort((a, b) => a.day - b.day),
    unitCount,
    baseSalary,
    baseUnits: constants.base_units,
    overageUnits,
    overageBonus,
    machineBonus,
    machineBonusLines,
    attendanceDays,
    leaveDays,
    fullAttendance,
    attendanceBonus,
    mealAllowance,
    marketingPoints,
    marketingBonus,
    monthlyAdjustments,
    monthBonus,
    monthDeduction,
    monthTotal,
    totalItems: unitCount,
    constants,
    finalized: false,
  };
}
