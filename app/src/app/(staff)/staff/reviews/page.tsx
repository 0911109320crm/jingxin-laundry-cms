import { redirect } from "next/navigation";
import { Star, Trophy, TrendingUp } from "lucide-react";
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

type ReviewRow = {
  id: string;
  order_code: string;
  reviewed_at: string;
  review_credited_to: string;
  customer: { name: string } | null;
};

export default async function StaffReviewsPage({
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

  // 1) All reviewed orders this month (admin client so we can see all techs for leaderboard)
  const { data: monthData } = await admin
    .from("orders")
    .select("id, order_code, reviewed_at, review_credited_to, customer:customers(name)")
    .eq("got_5star_review", true)
    .gte("reviewed_at", startIso)
    .lt("reviewed_at", endIso)
    .order("reviewed_at", { ascending: false });
  const monthReviews = (monthData as ReviewRow[] | null) ?? [];

  // 2) Per-tech monthly counts → leaderboard
  const counts = new Map<string, number>();
  for (const r of monthReviews) {
    if (!r.review_credited_to) continue;
    counts.set(r.review_credited_to, (counts.get(r.review_credited_to) ?? 0) + 1);
  }
  const techIds = Array.from(counts.keys());
  const { data: techs } = techIds.length
    ? await admin.from("user_profiles").select("id, name").in("id", techIds)
    : { data: [] };
  const techNameMap = new Map(
    ((techs ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]),
  );
  const leaderboard = Array.from(counts.entries())
    .map(([userId, n]) => ({
      userId,
      name: techNameMap.get(userId) ?? "（離職師傅）",
      count: n,
    }))
    .sort((a, b) => b.count - a.count);

  // 3) Me — this month
  const myMonthCount = counts.get(me.id) ?? 0;
  const myRank = leaderboard.findIndex((r) => r.userId === me.id) + 1; // 0 if not on board
  const myMonthReviews = monthReviews.filter(
    (r) => r.review_credited_to === me.id,
  );

  // 4) Me — all-time
  const { count: myAllTime } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("got_5star_review", true)
    .eq("review_credited_to", me.id);

  // Month nav
  const [y, m] = month.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  const next = new Date(y, m, 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="p-4 space-y-4">
      <header className="space-y-2">
        <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
          <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
          我的好評
        </h1>
        <div className="flex items-center gap-1">
          <a
            href={`/staff/reviews?month=${fmt(prev)}`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            ←
          </a>
          <span className="flex-1 rounded bg-zinc-900 px-3 py-1.5 text-center text-sm font-medium text-white">
            {month}
          </span>
          <a
            href={`/staff/reviews?month=${fmt(next)}`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            →
          </a>
        </div>
      </header>

      {/* Big number card */}
      <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-100">
        <CardBody className="space-y-2 py-6 text-center">
          <p className="text-xs text-amber-700">本月五星好評</p>
          <div className="flex items-center justify-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${i < Math.min(myMonthCount, 5) ? "fill-yellow-500 text-yellow-500" : "text-zinc-300"}`}
              />
            ))}
          </div>
          <p className="text-5xl font-bold text-amber-900 font-mono">
            {myMonthCount}
          </p>
          <p className="text-xs text-amber-700">
            累計：{myAllTime ?? 0} 次
            {myRank > 0 && ` · 本月排名第 ${myRank} 名`}
          </p>
        </CardBody>
      </Card>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              本月排行榜
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
                    className={`flex items-center justify-between px-4 py-3 text-sm ${
                      isMe ? "bg-amber-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-center text-xs text-zinc-500">
                        {medal ?? idx + 1}
                      </span>
                      <span
                        className={`${isMe ? "font-bold text-amber-900" : "text-zinc-900"}`}
                      >
                        {r.name}
                        {isMe && " (我)"}
                      </span>
                    </div>
                    <span className="font-mono font-semibold">
                      {r.count} <span className="text-xs text-zinc-500">次</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* My reviews this month */}
      {myMonthReviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-zinc-500" />
              本月我獲得的好評（{myMonthReviews.length}）
            </CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-zinc-200">
              {myMonthReviews.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium text-zinc-900">
                      {r.customer?.name ?? "—"}
                    </p>
                    <p className="font-mono text-xs text-zinc-500">
                      {r.order_code}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {new Date(r.reviewed_at).toLocaleDateString("zh-TW")}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {monthReviews.length === 0 && (
        <Card>
          <CardBody className="py-10 text-center">
            <Star className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500">本月還沒有好評紀錄</p>
            <p className="mt-1 text-xs text-zinc-400">
              服務結束時別忘了請客戶在 Google 給予五星好評！
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
