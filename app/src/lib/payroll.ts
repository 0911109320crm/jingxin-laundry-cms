import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type CommissionType = "default" | "percent" | "amount";
export type DefaultCommissionType = "percent" | "amount";

export type PayrollAdjustmentBreakdown = {
  name: string;
  amount: number;
};

export type PayrollItem = {
  id: string;
  order_id: string;
  order_code: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  /** 該筆對薪資的貢獻（已套抽成） */
  commission_amount: number;
  /** 顯示用：百分比或固定金額/件 */
  commission_label: string;
  tag: string | null;
  service_code: string | null;
  service_name: string | null;
  customer_name: string;
  customer_code: string;
  payment_method: string;
  /** order-level addons 對該日的貢獻（只算 affects_commission=true 的，合計） */
  order_addons: number;
  order_discount: number;
  /** 加價明細（含名稱），UI 用來顯示「+300（加大 200、車馬 100）」 */
  order_addons_detail: PayrollAdjustmentBreakdown[];
  order_discount_detail: PayrollAdjustmentBreakdown[];
};

export type DailyRow = {
  day: number;
  date: string; // YYYY-MM-DD
  items: PayrollItem[];
  /** 該日所有 item 的 commission_amount 加總 */
  dayCommission: number;
  /** 該日加價（進薪資的） */
  dayAddon: number;
  /** 該日折扣（進薪資的） */
  dayDiscount: number;
  /** 該日匯款訂單數（非現金） */
  transferredCount: number;
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
  /** 基本計件抽成（每筆 item 加總） */
  monthBaseCommission: number;
  /** 進薪資的加價合計 */
  monthAddon: number;
  /** 進薪資的折扣合計 */
  monthDiscount: number;
  /** 本月獎勵合計 */
  monthBonus: number;
  /** 本月扣款合計 */
  monthDeduction: number;
  /** 應發 = base + addon − discount + bonus − deduction */
  monthTotal: number;
  totalItems: number;
  monthlyAdjustments: PayrollMonthlyAdj[];
  /** 預設抽成設定，供 UI 顯示 fallback 是什麼 */
  defaultCommissionType: DefaultCommissionType;
  defaultCommissionValue: number;
  /** 該月是否已 snapshot 鎖定 */
  finalized: boolean;
};

/**
 * 計算單筆抽成金額。
 * - percent: subtotal × value / 100
 * - amount:  value × quantity
 * - default: 套用全店預設值
 */
function computeCommission(
  subtotal: number,
  quantity: number,
  type: CommissionType,
  value: number,
  defaultType: DefaultCommissionType,
  defaultValue: number,
): { amount: number; label: string } {
  const effectiveType = type === "default" ? defaultType : type;
  const effectiveValue = type === "default" ? defaultValue : value;
  if (effectiveType === "percent") {
    return {
      amount: Math.round((subtotal * effectiveValue) / 100),
      label: `${effectiveValue}%${type === "default" ? "（預設）" : ""}`,
    };
  }
  return {
    amount: Math.round(effectiveValue * quantity),
    label: `$${effectiveValue}/件${type === "default" ? "（預設）" : ""}`,
  };
}

export async function fetchPayroll(
  technicianId: string,
  monthStr: string, // "YYYY-MM"
): Promise<PayrollData | null> {
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m) return null;

  const admin = createAdminClient();
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 1);

  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, name")
    .eq("id", technicianId)
    .single();
  const tech = profile as { id: string; name: string } | null;
  if (!tech) return null;

  // Parallel: order_items / system_settings / payroll_adjustments / snapshot
  const [
    { data: itemsRaw },
    { data: settingsRaw },
    { data: adjustmentsRaw },
    { data: snapshotRow },
  ] = await Promise.all([
    admin
      .from("order_items")
      .select(
        `id, order_id, unit_price, quantity, subtotal, tag,
         service:service_items(code, name, commission_type, commission_value),
         order:orders(order_code, status, service_at, scheduled_at, payment_method,
                      customer:customers(name, code),
                      adjustments:order_adjustments(
                        type, amount, name_snapshot,
                        item:adjustment_items(affects_commission)
                      ))`,
      )
      .eq("technician_id", technicianId)
      .gte("orders.scheduled_at", monthStart.toISOString())
      .lt("orders.scheduled_at", monthEnd.toISOString()),
    admin
      .from("system_settings")
      .select("key, value")
      .in("key", ["default_commission_type", "default_commission_value"]),
    admin
      .from("payroll_adjustments")
      .select("id, type, amount, reason, created_at")
      .eq("technician_id", technicianId)
      .eq("month", monthStr)
      .order("created_at", { ascending: false }),
    admin
      .from("payroll_snapshots")
      .select("breakdown")
      .eq("technician_id", technicianId)
      .eq("month", monthStr)
      .maybeSingle(),
  ]);

  // 已結算：直接讀 snapshot 不再計算（freeze 歷史薪資）
  if (snapshotRow?.breakdown) {
    const b = snapshotRow.breakdown as {
      rows: DailyRow[];
      monthBaseCommission: number;
      monthAddon: number;
      monthDiscount: number;
      monthBonus: number;
      monthDeduction: number;
      monthTotal: number;
      totalItems: number;
      monthlyAdjustments: PayrollMonthlyAdj[];
      defaultCommissionType: DefaultCommissionType;
      defaultCommissionValue: number;
    };
    return {
      technician: tech,
      year: y,
      month: m,
      rows: b.rows,
      monthBaseCommission: b.monthBaseCommission,
      monthAddon: b.monthAddon,
      monthDiscount: b.monthDiscount,
      monthBonus: b.monthBonus,
      monthDeduction: b.monthDeduction,
      monthTotal: b.monthTotal,
      totalItems: b.totalItems,
      monthlyAdjustments: b.monthlyAdjustments,
      defaultCommissionType: b.defaultCommissionType,
      defaultCommissionValue: b.defaultCommissionValue,
      finalized: true,
    };
  }

  // System settings
  const settingsMap = new Map(
    ((settingsRaw as { key: string; value: unknown }[] | null) ?? []).map(
      (r) => [r.key, r.value],
    ),
  );
  const defaultCommissionType =
    (settingsMap.get("default_commission_type") as DefaultCommissionType) ??
    "percent";
  const defaultCommissionValue = Number(
    settingsMap.get("default_commission_value") ?? 60,
  );

  type Raw = {
    id: string;
    order_id: string;
    unit_price: number;
    quantity: number;
    subtotal: number;
    tag: string | null;
    service: {
      code: string;
      name: string;
      commission_type: CommissionType;
      commission_value: number;
    } | null;
    order: {
      order_code: string;
      status: string;
      service_at: string | null;
      scheduled_at: string | null;
      payment_method: string;
      customer: { name: string; code: string } | null;
      adjustments: {
        type: "addon" | "discount";
        amount: number;
        name_snapshot: string;
        item: { affects_commission: boolean } | null;
      }[];
    } | null;
  };

  const items = (itemsRaw as Raw[] | null) ?? [];

  // Build day rows
  const byDay = new Map<number, DailyRow>();
  for (let d = 1; d <= 31; d++) {
    const check = new Date(y, m - 1, d);
    if (check.getMonth() !== m - 1) continue;
    byDay.set(d, {
      day: d,
      date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      items: [],
      dayCommission: 0,
      dayAddon: 0,
      dayDiscount: 0,
      transferredCount: 0,
    });
  }

  const seenOrderForAdjPerDay = new Map<string, Set<string>>();
  const seenOrderForPayment = new Map<string, Set<string>>();

  for (const it of items) {
    if (!it.order) continue;
    if (it.order.status === "cancelled") continue;
    const dateStr = (it.order.service_at ?? it.order.scheduled_at)?.slice(0, 10);
    if (!dateStr) continue;
    const day = Number(dateStr.slice(8, 10));
    const row = byDay.get(day);
    if (!row) continue;

    // affects_commission filter on adjustments
    // null item (自訂無 master) → 視為 true（多做的工，沿用原行為）
    const effectiveAdj = it.order.adjustments.filter(
      (a) => a.item?.affects_commission ?? true,
    );
    const addonsDetail: PayrollAdjustmentBreakdown[] = effectiveAdj
      .filter((a) => a.type === "addon")
      .map((a) => ({ name: a.name_snapshot, amount: Number(a.amount) }));
    const discountDetail: PayrollAdjustmentBreakdown[] = effectiveAdj
      .filter((a) => a.type === "discount")
      .map((a) => ({ name: a.name_snapshot, amount: Number(a.amount) }));
    const addons = addonsDetail.reduce((s, a) => s + a.amount, 0);
    const discount = discountDetail.reduce((s, a) => s + a.amount, 0);

    // Count adjustments only once per order per day
    if (!seenOrderForAdjPerDay.has(dateStr))
      seenOrderForAdjPerDay.set(dateStr, new Set());
    const seen = seenOrderForAdjPerDay.get(dateStr)!;
    let orderAddon = 0;
    let orderDiscount = 0;
    let orderAddonDetail: PayrollAdjustmentBreakdown[] = [];
    let orderDiscountDetail: PayrollAdjustmentBreakdown[] = [];
    if (!seen.has(it.order_id)) {
      seen.add(it.order_id);
      orderAddon = addons;
      orderDiscount = discount;
      orderAddonDetail = addonsDetail;
      orderDiscountDetail = discountDetail;
      row.dayAddon += addons;
      row.dayDiscount += discount;
    }

    // Count transfer once per order per day
    if (!seenOrderForPayment.has(dateStr))
      seenOrderForPayment.set(dateStr, new Set());
    const seenPay = seenOrderForPayment.get(dateStr)!;
    if (!seenPay.has(it.order_id)) {
      seenPay.add(it.order_id);
      if (
        it.order.payment_method === "transfer" ||
        it.order.payment_method === "card" ||
        it.order.payment_method === "line_pay"
      ) {
        row.transferredCount += 1;
      }
    }

    // 抽成計算
    const { amount: commissionAmount, label: commissionLabel } =
      computeCommission(
        Number(it.subtotal),
        Number(it.quantity) || 1,
        (it.service?.commission_type ?? "default") as CommissionType,
        Number(it.service?.commission_value ?? 0),
        defaultCommissionType,
        defaultCommissionValue,
      );

    row.items.push({
      id: it.id,
      order_id: it.order_id,
      order_code: it.order.order_code,
      unit_price: Number(it.unit_price),
      quantity: Number(it.quantity) || 1,
      subtotal: Number(it.subtotal),
      commission_amount: commissionAmount,
      commission_label: commissionLabel,
      tag: it.tag,
      service_code: it.service?.code ?? null,
      service_name: it.service?.name ?? null,
      customer_name: it.order.customer?.name ?? "—",
      customer_code: it.order.customer?.code ?? "",
      payment_method: it.order.payment_method,
      order_addons: orderAddon,
      order_discount: orderDiscount,
      order_addons_detail: orderAddonDetail,
      order_discount_detail: orderDiscountDetail,
    });
    row.dayCommission += commissionAmount;
  }

  // Aggregate totals
  let monthBaseCommission = 0;
  let monthAddon = 0;
  let monthDiscount = 0;
  let totalItems = 0;
  for (const row of byDay.values()) {
    monthBaseCommission += row.dayCommission;
    monthAddon += row.dayAddon;
    monthDiscount += row.dayDiscount;
    totalItems += row.items.length;
  }

  // 月度調整（bonus / deduction）
  const monthlyAdjustments =
    (adjustmentsRaw as PayrollMonthlyAdj[] | null) ?? [];
  const monthBonus = monthlyAdjustments
    .filter((a) => a.type === "bonus")
    .reduce((s, a) => s + Number(a.amount), 0);
  const monthDeduction = monthlyAdjustments
    .filter((a) => a.type === "deduction")
    .reduce((s, a) => s + Number(a.amount), 0);

  const monthTotal =
    monthBaseCommission +
    monthAddon -
    monthDiscount +
    monthBonus -
    monthDeduction;

  return {
    technician: tech,
    year: y,
    month: m,
    rows: Array.from(byDay.values()).sort((a, b) => a.day - b.day),
    monthBaseCommission,
    monthAddon,
    monthDiscount,
    monthBonus,
    monthDeduction,
    monthTotal,
    totalItems,
    monthlyAdjustments,
    defaultCommissionType,
    defaultCommissionValue,
    finalized: false,
  };
}
