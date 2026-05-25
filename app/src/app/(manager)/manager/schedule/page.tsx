import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTaiwanDate } from "@/lib/utils";

type Order = {
  id: string;
  order_code: string;
  scheduled_at: string;
  scheduled_end_at: string | null;
  duration_minutes: number | null;
  customer: { name: string } | null;
  address: { county: string; district: string } | null;
  items: { technician_id: string | null }[];
};

type Tech = { id: string; name: string };

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

export default async function ManagerSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

  // Week window：以 sp.start (YYYY-MM-DD) 為起點，預設今天。連續 7 天。
  const weekStart = sp.start ? parseDate(sp.start) : startOfTodayTw();
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const fromIso = days[0].toISOString();
  const toIso = endOfDay(days[6]).toISOString();
  const prevWeekStart = formatTaiwanDate(addDays(weekStart, -7));
  const nextWeekStart = formatTaiwanDate(addDays(weekStart, 7));

  const [{ data: techsData }, { data: ordersData }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("id, name")
      .eq("active", true)
      .eq("role", "technician")
      .order("name"),
    supabase
      .from("orders")
      .select(
        `id, order_code, scheduled_at, scheduled_end_at, duration_minutes,
         customer:customers(name),
         address:customer_addresses(county, district),
         items:order_items(technician_id)`,
      )
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", fromIso)
      .lte("scheduled_at", toIso)
      .neq("status", "cancelled")
      .order("scheduled_at"),
  ]);

  const technicians = (techsData as Tech[] | null) ?? [];
  const orders = (ordersData as unknown as Order[] | null) ?? [];

  // 索引：tech_id × YYYY-MM-DD → 訂單清單
  const grid = new Map<string, Order[]>();
  // 未指派師傅的訂單另列
  const unassigned = new Map<string, Order[]>();

  for (const o of orders) {
    const dateKey = formatTaiwanDate(o.scheduled_at);
    // 訂單可能多技師（多個 order_items 指派不同人）→ 對每位技師都掛一筆
    const techIds = new Set<string>();
    for (const it of o.items ?? []) {
      if (it.technician_id) techIds.add(it.technician_id);
    }
    if (techIds.size === 0) {
      const key = dateKey;
      const arr = unassigned.get(key) ?? [];
      arr.push(o);
      unassigned.set(key, arr);
    } else {
      for (const tid of techIds) {
        const key = `${tid}|${dateKey}`;
        const arr = grid.get(key) ?? [];
        arr.push(o);
        grid.set(key, arr);
      }
    }
  }

  return (
    <div className="p-3 space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-base font-bold text-zinc-900">一周排案總覽</h1>
        <div className="flex items-center gap-1 text-xs">
          <Link
            href={`/manager/schedule?start=${prevWeekStart}`}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700"
          >
            ← 上週
          </Link>
          <Link
            href="/manager/schedule"
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700"
          >
            本週
          </Link>
          <Link
            href={`/manager/schedule?start=${nextWeekStart}`}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700"
          >
            下週 →
          </Link>
        </div>
      </header>

      <p className="text-xs text-zinc-500">
        {formatTaiwanDate(days[0])} ~ {formatTaiwanDate(days[6])} ·{" "}
        {technicians.length} 位師傅 · {orders.length} 個排案
      </p>

      {/* Horizontal-scrolling timeline: 列=師傅, 欄=日期 */}
      <div className="overflow-x-auto -mx-3 px-3 pb-2">
        <table className="min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-zinc-100 px-2 py-1 text-left font-medium text-zinc-700">
                師傅
              </th>
              {days.map((d) => {
                const ymd = formatTaiwanDate(d);
                const isToday = ymd === formatTaiwanDate(new Date());
                return (
                  <th
                    key={ymd}
                    className={`min-w-[7.5rem] border-l border-zinc-200 bg-zinc-50 px-2 py-1 text-center font-medium ${
                      isToday ? "bg-brand-50 text-brand-700" : "text-zinc-700"
                    }`}
                  >
                    {ymd.slice(5)} ({DAY_NAMES[d.getDay()]})
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {technicians.map((tech) => (
              <tr key={tech.id}>
                <td className="sticky left-0 z-10 bg-white px-2 py-1.5 align-top font-medium text-zinc-900 border-t border-zinc-200">
                  {tech.name}
                </td>
                {days.map((d) => {
                  const ymd = formatTaiwanDate(d);
                  const cellOrders = grid.get(`${tech.id}|${ymd}`) ?? [];
                  const total = cellOrders.reduce(
                    (s, o) => s + (o.duration_minutes ?? 90),
                    0,
                  );
                  return (
                    <td
                      key={ymd}
                      className="border-l border-t border-zinc-200 bg-white p-1 align-top"
                    >
                      <div className="space-y-1">
                        {cellOrders.length === 0 && (
                          <p className="text-center text-zinc-300">·</p>
                        )}
                        {cellOrders.map((o) => (
                          <Link
                            key={o.id}
                            href={`/orders/${o.id}`}
                            className="block rounded bg-brand-50 px-1.5 py-1 text-[11px] leading-tight text-brand-800 hover:bg-brand-100"
                          >
                            <div className="font-mono text-[10px] text-brand-600">
                              {timeHM(o.scheduled_at)} · {o.duration_minutes ?? 90}分
                            </div>
                            <div className="truncate font-medium">
                              {o.customer?.name ?? "—"}
                            </div>
                            {o.address && (
                              <div className="truncate text-zinc-500">
                                {o.address.district}
                              </div>
                            )}
                          </Link>
                        ))}
                        {cellOrders.length > 1 && (
                          <p className="text-center text-[10px] text-zinc-400">
                            共 {total} 分
                          </p>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* 未指派列 */}
            <tr>
              <td className="sticky left-0 z-10 bg-amber-50 px-2 py-1.5 align-top text-amber-800 border-t border-zinc-200">
                未指派
              </td>
              {days.map((d) => {
                const ymd = formatTaiwanDate(d);
                const cellOrders = unassigned.get(ymd) ?? [];
                return (
                  <td
                    key={ymd}
                    className="border-l border-t border-zinc-200 bg-amber-50/40 p-1 align-top"
                  >
                    <div className="space-y-1">
                      {cellOrders.length === 0 && (
                        <p className="text-center text-zinc-300">·</p>
                      )}
                      {cellOrders.map((o) => (
                        <Link
                          key={o.id}
                          href={`/orders/${o.id}`}
                          className="block rounded bg-amber-100 px-1.5 py-1 text-[11px] leading-tight text-amber-900 hover:bg-amber-200"
                        >
                          <div className="font-mono text-[10px] text-amber-700">
                            {timeHM(o.scheduled_at)}
                          </div>
                          <div className="truncate font-medium">
                            {o.customer?.name ?? "—"}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function startOfTodayTw(): Date {
  const ymd = formatTaiwanDate(new Date());
  return parseDate(ymd);
}
function parseDate(ymd: string): Date {
  // 用 Taiwan 早晨 8:00 當該日代表時刻避開時區滑動
  return new Date(`${ymd}T08:00:00+08:00`);
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function endOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}
function timeHM(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  }).format(d);
}
