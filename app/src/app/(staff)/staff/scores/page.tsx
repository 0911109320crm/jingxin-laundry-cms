import { redirect } from "next/navigation";
import { Star, Trophy, TrendingUp, Target } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
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
  credited_to: string;
  points_snapshot: number;
  created_at: string;
  order: { order_code: string; customer: { name: string } | null } | null;
  type: { label: string } | null;
};

export default async function StaffScoresPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const sp = await searchParams;
  const month = sp.month ?? currentMonth();
  const { startIso, endIso } = monthRange(month);

  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: monthData }, { data: kpiRow }] = await Promise.all([
    admin
      .from("order_promotions")
      .select(
        "id, order_id, credited_to, points_snapshot, created_at, order:orders(order_code, customer:customers(name)), type:promotion_types(label)",
      )
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .order("created_at", { ascending: false }),
    admin
      .from("system_settings")
      .select("value")
      .eq("key", "monthly_promotion_kpi")
      .maybeSingle(),
  ]);

  const monthPromos = (monthData as PromoRow[] | null) ?? [];
  const kpi = typeof kpiRow?.value === "number" ? kpiRow.value : 30;

  // 每位師傅本月積分
  const pointsByTech = new Map<string, number>();
  for (const p of monthPromos) {
    if (!p.credited_to) continue;
    pointsByTech.set(
      p.credited_to,
      (pointsByTech.get(p.credited_to) ?? 0) + p.points_snapshot,
    );
  }
  const techIds = Array.from(pointsByTech.keys());
  const { data: techs } = techIds.length
    ? await admin.from("user_profiles").select("id, name").in("id", techIds)
    : { data: [] };
  const techNameMap = new Map(
    ((techs ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]),
  );
  const leaderboard = Array.from(pointsByTech.entries())
    .map(([userId, points]) => ({
      userId,
      name: techNameMap.get(userId) ?? "（離職師傅）",
      points,
    }))
    .sort((a, b) => b.points - a.points);

  const myMonthPoints = pointsByTech.get(me.id) ?? 0;
  const myMonthCount = monthPromos.filter((r) => r.credited_to === me.id).length;
  const myRank = leaderboard.findIndex((r) => r.userId === me.id) + 1;
  const myMonthPromos = monthPromos.filter((r) => r.credited_to === me.id);
  const myProgressPct = Math.min(100, Math.round((myMonthPoints / kpi) * 100));
  const achieved = myMonthPoints >= kpi;

  // 累計
  const { data: allTimePoints } = await supabase
    .from("order_promotions")
    .select("points_snapshot")
    .eq("credited_to", me.id);
  const myAllTime = ((allTimePoints as { points_snapshot: number }[] | null) ?? []).reduce(
    (s, r) => s + r.points_snapshot,
    0,
  );

  const [y, m] = month.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  const next = new Date(y, m, 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="p-4 space-y-4">
      <header className="space-y-2">
        <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
          <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
          我的積分
        </h1>
        <div className="flex items-center gap-1">
          <a
            href={`/staff/scores?month=${fmt(prev)}`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            ←
          </a>
          <span className="flex-1 rounded bg-zinc-900 px-3 py-1.5 text-center text-sm font-medium text-white">
            {month}
          </span>
          <a
            href={`/staff/scores?month=${fmt(next)}`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            →
          </a>
        </div>
      </header>

      <Card
        className={
          achieved
            ? "border-green-300 bg-gradient-to-br from-green-50 to-emerald-100"
            : "border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100"
        }
      >
        <CardBody className="space-y-3 py-6 text-center">
          <p className={achieved ? "text-xs text-green-700" : "text-xs text-amber-700"}>
            本月積分（KPI {kpi} 分）
          </p>
          <p className={achieved ? "text-6xl font-bold text-green-800 font-mono" : "text-6xl font-bold text-amber-900 font-mono"}>
            {myMonthPoints}
          </p>
          <div className="mx-auto h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/60">
            <div
              className={achieved ? "h-full bg-green-500" : "h-full bg-amber-500"}
              style={{ width: `${myProgressPct}%` }}
            />
          </div>
          <p className={achieved ? "text-xs text-green-700" : "text-xs text-amber-700"}>
            {achieved ? "🎉 已達標！" : `還差 ${kpi - myMonthPoints} 分達標`} ·{" "}
            {myMonthCount} 筆促銷 · 累計 {myAllTime} 分
            {myRank > 0 && ` · 本月排名第 ${myRank} 名`}
          </p>
        </CardBody>
      </Card>

      {leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              本月排行
            </CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-zinc-200">
              {leaderboard.map((r, idx) => {
                const isMe = r.userId === me.id;
                const medal =
                  idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                return (
                  <li
                    key={r.userId}
                    className={`flex items-center justify-between gap-2 px-4 py-3 text-sm ${
                      isMe ? "bg-amber-50" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-6 shrink-0 text-center text-xs text-zinc-500">
                        {medal ?? idx + 1}
                      </span>
                      <span className={`truncate ${isMe ? "font-bold text-amber-900" : "text-zinc-900"}`}>
                        {r.name}
                        {isMe && " (我)"}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono font-semibold">
                      {r.points} <span className="text-xs text-zinc-500">分</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      {myMonthPromos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-zinc-500" />
              本月我獲得的促銷積分（{myMonthPromos.length}）
            </CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-zinc-200">
              {myMonthPromos.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900">
                      {r.order?.customer?.name ?? "—"}
                    </p>
                    <p className="truncate font-mono text-xs text-zinc-500">
                      {r.order?.order_code} · {r.type?.label ?? "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-bold text-amber-700">
                      +{r.points_snapshot}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {new Date(r.created_at).toLocaleDateString("zh-TW")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {monthPromos.length === 0 && (
        <Card>
          <CardBody className="py-10 text-center">
            <Target className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500">本月還沒有任何積分</p>
            <p className="mt-1 text-xs text-zinc-400">
              服務時記得請客戶協助 FB / Google / 地方社團發文，每筆都會計分！
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
