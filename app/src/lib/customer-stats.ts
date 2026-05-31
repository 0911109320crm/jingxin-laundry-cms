export type CustomerStatsInput = {
  status: string;
  service_at: string | null;
  total: number;
};

export type CustomerStats = {
  totalSpent: number;
  doneCount: number;
  cancelCount: number;
  lastServiceAt: string | null;
  monthsSinceLast: number | null;
  avgCycleMonths: number | null;
};

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.4;

export function computeCustomerStats(
  orders: CustomerStatsInput[],
): CustomerStats {
  const totalSpent = orders
    .filter((o) => o.status === "done")
    .reduce((s, o) => s + Number(o.total), 0);
  const doneCount = orders.filter((o) => o.status === "done").length;
  const cancelCount = orders.filter((o) => o.status === "cancelled").length;

  const doneOrders = orders
    .filter((o) => o.status === "done" && o.service_at)
    .sort(
      (a, b) =>
        new Date(b.service_at!).getTime() - new Date(a.service_at!).getTime(),
    );
  const lastServiceAt = doneOrders[0]?.service_at ?? null;
  const monthsSinceLast = lastServiceAt
    ? Math.round((Date.now() - new Date(lastServiceAt).getTime()) / MS_PER_MONTH)
    : null;

  let avgCycleMonths: number | null = null;
  if (doneOrders.length >= 2) {
    const intervals: number[] = [];
    for (let i = 0; i < doneOrders.length - 1; i++) {
      const a = new Date(doneOrders[i].service_at!).getTime();
      const b = new Date(doneOrders[i + 1].service_at!).getTime();
      intervals.push((a - b) / MS_PER_MONTH);
    }
    avgCycleMonths = Math.round(
      intervals.reduce((s, v) => s + v, 0) / intervals.length,
    );
  }

  return {
    totalSpent,
    doneCount,
    cancelCount,
    lastServiceAt,
    monthsSinceLast,
    avgCycleMonths,
  };
}

/**
 * 把月數轉成易讀的「X 年 Y 個月」。
 * 例：77 →「6 年 5 個月」、12 →「1 年」、8 →「8 個月」、null → 自訂 fallback。
 */
export function formatMonths(
  months: number | null | undefined,
  fallback = "—",
): string {
  if (months == null) return fallback;
  if (months < 12) return `${months} 個月`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} 年` : `${y} 年 ${m} 個月`;
}
