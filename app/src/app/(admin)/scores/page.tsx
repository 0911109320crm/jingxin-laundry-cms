import Link from "next/link";
import { Trophy, Target, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

type SP = Promise<{ month?: string }>;

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

type PromoRow = {
  id: string;
  order_id: string;
  promotion_type_id: string;
  credited_to: string | null;
  points_snapshot: number;
  created_at: string;
  order: { order_code: string; customer: { name: string } | null } | null;
  type: { code: string; label: string } | null;
};

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await requireRole(["owner", "manager"]);
  const sp = await searchParams;
  const month = sp.month ?? currentMonth();
  const { startIso, endIso } = monthRange(month);

  const admin = createAdminClient();
  const [
    { data: promosData },
    { data: techData },
    { count: allTimePromos },
    { data: kpiRow },
  ] = await Promise.all([
    admin
      .from("order_promotions")
      .select(
        "id, order_id, promotion_type_id, credited_to, points_snapshot, created_at, order:orders(order_code, customer:customers(name)), type:promotion_types(code, label)",
      )
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .order("created_at", { ascending: false }),
    admin
      .from("user_profiles")
      .select("id, name, role")
      .eq("active", true)
      .in("role", ["technician", "manager", "owner"]),
    admin
      .from("order_promotions")
      .select("id", { count: "exact", head: true }),
    admin
      .from("system_settings")
      .select("value")
      .eq("key", "monthly_promotion_kpi")
      .maybeSingle(),
  ]);

  const monthPromos = (promosData as PromoRow[] | null) ?? [];
  const techs = (techData as { id: string; name: string; role: string }[] | null) ?? [];
  const techMap = new Map(techs.map((t) => [t.id, t]));
  const kpi = typeof kpiRow?.value === "number" ? kpiRow.value : 30;

  // Aggregate: 每位師傅本月積分總和
  const pointsByTech = new Map<string, { points: number; count: number }>();
  for (const p of monthPromos) {
    if (!p.credited_to) continue;
    const cur = pointsByTech.get(p.credited_to) ?? { points: 0, count: 0 };
    cur.points += p.points_snapshot;
    cur.count += 1;
    pointsByTech.set(p.credited_to, cur);
  }
  const leaderboard = Array.from(pointsByTech.entries())
    .map(([id, agg]) => ({
      id,
      name: techMap.get(id)?.name ?? "（離職）",
      role: techMap.get(id)?.role ?? "",
      points: agg.points,
      count: agg.count,
      achieved: agg.points >= kpi,
    }))
    .sort((a, b) => b.points - a.points);

  // 各促銷類型本月次數統計
  const byType = new Map<string, { label: string; count: number; points: number }>();
  for (const p of monthPromos) {
    const code = p.type?.code ?? "(unknown)";
    const cur = byType.get(code) ?? {
      label: p.type?.label ?? "(已刪除)",
      count: 0,
      points: 0,
    };
    cur.count += 1;
    cur.points += p.points_snapshot;
    byType.set(code, cur);
  }
  const typeStats = Array.from(byType.entries())
    .map(([code, agg]) => ({ code, ...agg }))
    .sort((a, b) => b.count - a.count);

  // Achievement summary
  const totalPoints = monthPromos.reduce((s, p) => s + p.points_snapshot, 0);
  const achieversCount = leaderboard.filter((r) => r.achieved).length;

  // Month nav
  const [y, m] = month.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  const next = new Date(y, m, 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="p-8 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900">
            <Trophy className="h-6 w-6 text-yellow-500" />
            師傅促銷積分
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            師傅在訂單上勾選客戶做過的促銷動作即計分。每月 KPI 目標 {kpi} 分。
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/scores?month=${fmt(prev)}`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            ←
          </Link>
          <span className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">
            {month}
          </span>
          <Link
            href={`/scores?month=${fmt(next)}`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            →
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100">
          <CardBody className="text-center">
            <p className="text-xs text-amber-700">本月總積分</p>
            <p className="mt-1 text-4xl font-bold text-amber-900 font-mono">{totalPoints}</p>
            <p className="mt-1 text-xs text-amber-700">分</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-zinc-500">本月促銷次數</p>
            <p className="mt-1 text-4xl font-bold text-zinc-900 font-mono">{monthPromos.length}</p>
            <p className="mt-1 text-xs text-zinc-500">筆</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-zinc-500">達標師傅</p>
            <p className="mt-1 text-4xl font-bold text-zinc-900 font-mono">
              {achieversCount}
              <span className="text-base text-zinc-400"> / {leaderboard.length}</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">人（KPI ≥ {kpi}）</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-zinc-500">累計總促銷</p>
            <p className="mt-1 text-4xl font-bold text-zinc-900 font-mono">{allTimePromos ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">筆</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            本月積分排行
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {leaderboard.length === 0 ? (
            <p className="p-5 text-center text-sm text-zinc-500">本月還沒有任何積分紀錄</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {leaderboard.map((r, idx) => {
                const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                const pct = Math.min(100, Math.round((r.points / kpi) * 100));
                return (
                  <li key={r.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-8 text-center text-base">
                          {medal ?? <span className="text-xs text-zinc-400">{idx + 1}</span>}
                        </span>
                        <div>
                          <p className="font-medium text-zinc-900">{r.name}</p>
                          <p className="text-xs text-zinc-500">
                            {r.role} · {r.count} 筆促銷
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-lg font-bold text-zinc-900">{r.points}</span>
                        <span className="text-xs text-zinc-500"> / {kpi} 分</span>
                        {r.achieved && (
                          <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            達標 ✓
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={r.achieved ? "h-full bg-green-500" : "h-full bg-amber-400"}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-zinc-500" />
            本月促銷類型分布
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {typeStats.length === 0 ? (
            <p className="p-5 text-center text-sm text-zinc-500">無資料</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {typeStats.map((t) => (
                <li key={t.code} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-zinc-900">{t.label}</p>
                    <p className="text-xs font-mono text-zinc-400">{t.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-base font-semibold text-zinc-900">{t.count} 次</p>
                    <p className="text-xs text-zinc-500">小計 {t.points} 分</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-zinc-500" />
            本月明細
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {monthPromos.length === 0 ? (
            <p className="p-5 text-center text-sm text-zinc-500">無資料</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {monthPromos.map((p) => (
                <li key={p.id} className="px-5 py-3 text-sm">
                  <Link
                    href={`/orders/${p.order_id}`}
                    className="-mx-5 flex items-center justify-between px-5 hover:bg-zinc-50"
                  >
                    <div>
                      <p className="font-mono text-xs text-zinc-500">
                        {p.order?.order_code ?? "—"}
                      </p>
                      <p className="font-medium text-zinc-900">
                        {p.order?.customer?.name ?? "—"} · {p.type?.label ?? "(已刪除)"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold text-amber-700">
                        +{p.points_snapshot}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {p.credited_to ? techMap.get(p.credited_to)?.name ?? "（離職）" : "—"}
                        ・{new Date(p.created_at).toLocaleDateString("zh-TW")}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
