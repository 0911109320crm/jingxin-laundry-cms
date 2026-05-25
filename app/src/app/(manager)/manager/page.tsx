import Link from "next/link";
import {
  CalendarRange,
  PackageSearch,
  Wallet,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function ManagerHomePage() {
  const supabase = await createClient();

  // 抓三個關鍵數字當主選單上的徽章
  const todayStart = startOfTodayIso();
  const todayEnd = endOfTodayIso();
  const weekEnd = isoPlusDays(7);

  const [pendingCount, weekScheduledCount, todaySettleCount] = await Promise.all([
    countPendingDispatch(supabase),
    countScheduledRange(supabase, new Date().toISOString(), weekEnd),
    countTodaySettlements(supabase, todayStart, todayEnd),
  ]);

  return (
    <div className="space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-zinc-900">老闆娘專屬</h1>
        <p className="mt-1 text-xs text-zinc-500">
          一指掌握排案 / 派工 / 回繳，現場調度更快
        </p>
      </header>

      <ManagerCard
        href="/manager/schedule"
        icon={CalendarRange}
        title="一周排案總覽"
        desc="查 4 位師傅本週每天接什麼案，方便緊急調度"
        badge={`${weekScheduledCount} 案`}
      />
      <ManagerCard
        href="/manager/pending"
        icon={PackageSearch}
        title="待派案"
        desc="按地址鄉鎮排序，挑順路師傅最快"
        badge={`${pendingCount} 案`}
        urgent={pendingCount > 0}
      />
      <ManagerCard
        href="/manager/settle-today"
        icon={Wallet}
        title="今日回繳"
        desc="師傅當日待回繳金額 + 一鍵核帳"
        badge={`${todaySettleCount} 案`}
      />
    </div>
  );
}

function ManagerCard({
  href,
  icon: Icon,
  title,
  desc,
  badge,
  urgent,
}: {
  href: string;
  icon: typeof CalendarRange;
  title: string;
  desc: string;
  badge: string;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm active:bg-zinc-50"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            urgent ? "bg-amber-100 text-amber-700" : "bg-brand-50 text-brand-700"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-zinc-900">{title}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                urgent
                  ? "bg-amber-100 text-amber-800"
                  : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {badge}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
      </div>
    </Link>
  );
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function endOfTodayIso() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
function isoPlusDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

type SC = Awaited<ReturnType<typeof createClient>>;

async function countPendingDispatch(s: SC) {
  // status='scheduled' 但有 order_item 沒指派師傅；或 status='pending'
  // 簡化：先抓 status in (pending, scheduled) 且沒人派的訂單
  const { count } = await s
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending"]);
  return count ?? 0;
}

async function countScheduledRange(s: SC, fromIso: string, toIso: string) {
  const { count } = await s
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("scheduled_at", fromIso)
    .lte("scheduled_at", toIso)
    .in("status", ["scheduled", "done"]);
  return count ?? 0;
}

async function countTodaySettlements(s: SC, fromIso: string, toIso: string) {
  const { count } = await s
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("settlement_status", "pending")
    .gte("service_at", fromIso)
    .lte("service_at", toIso);
  return count ?? 0;
}
