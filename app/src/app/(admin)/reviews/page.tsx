import { Star, Trophy } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import Link from "next/link";

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
  review_credited_to: string | null;
  customer: { name: string; phone: string } | null;
};

export default async function ReviewsReportPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await requireRole(["owner", "manager"]);
  const sp = await searchParams;
  const month = sp.month ?? currentMonth();
  const { startIso, endIso } = monthRange(month);

  const admin = createAdminClient();
  const [{ data: monthData }, { data: techData }, { count: allTimeCount }] = await Promise.all([
    admin
      .from("orders")
      .select(
        "id, order_code, reviewed_at, review_credited_to, customer:customers(name, phone)",
      )
      .eq("got_5star_review", true)
      .gte("reviewed_at", startIso)
      .lt("reviewed_at", endIso)
      .order("reviewed_at", { ascending: false }),
    admin
      .from("user_profiles")
      .select("id, name, role")
      .eq("active", true)
      .in("role", ["technician", "manager", "owner"]),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("got_5star_review", true),
  ]);

  const monthReviews = (monthData as ReviewRow[] | null) ?? [];
  const techs = (techData as { id: string; name: string; role: string }[] | null) ?? [];
  const techMap = new Map(techs.map((t) => [t.id, t]));

  // Per-tech count this month
  const counts = new Map<string, number>();
  for (const r of monthReviews) {
    if (!r.review_credited_to) continue;
    counts.set(
      r.review_credited_to,
      (counts.get(r.review_credited_to) ?? 0) + 1,
    );
  }
  const leaderboard = Array.from(counts.entries())
    .map(([id, n]) => ({
      id,
      name: techMap.get(id)?.name ?? "（離職）",
      role: techMap.get(id)?.role ?? "",
      count: n,
    }))
    .sort((a, b) => b.count - a.count);

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
            <Star className="h-6 w-6 fill-yellow-500 text-yellow-500" />
            師傅好評排行榜
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            鼓勵師傅請客戶到 Google 留五星好評，老闆娘看到後到該筆訂單詳情頁標記
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/reviews?month=${fmt(prev)}`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            ←
          </Link>
          <span className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">
            {month}
          </span>
          <Link
            href={`/reviews?month=${fmt(next)}`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            →
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-100">
          <CardBody className="text-center">
            <p className="text-xs text-amber-700">本月好評</p>
            <p className="mt-1 text-4xl font-bold text-amber-900 font-mono">
              {monthReviews.length}
            </p>
            <p className="mt-1 text-xs text-amber-700">次</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-zinc-500">參與師傅</p>
            <p className="mt-1 text-4xl font-bold text-zinc-900 font-mono">
              {leaderboard.length}
            </p>
            <p className="mt-1 text-xs text-zinc-500">人</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-zinc-500">累計總好評</p>
            <p className="mt-1 text-4xl font-bold text-zinc-900 font-mono">
              {allTimeCount ?? 0}
            </p>
            <p className="mt-1 text-xs text-zinc-500">次</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            本月排行
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {leaderboard.length === 0 ? (
            <p className="p-5 text-center text-sm text-zinc-500">
              本月還沒有任何好評紀錄
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {leaderboard.map((r, idx) => {
                const medal =
                  idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center text-base">
                        {medal ?? <span className="text-xs text-zinc-400">{idx + 1}</span>}
                      </span>
                      <div>
                        <p className="font-medium text-zinc-900">{r.name}</p>
                        <p className="text-xs text-zinc-500">{r.role}</p>
                      </div>
                    </div>
                    <span className="font-mono text-lg font-bold text-zinc-900">
                      {r.count}{" "}
                      <span className="text-xs text-zinc-500">次</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>本月好評明細</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {monthReviews.length === 0 ? (
            <p className="p-5 text-center text-sm text-zinc-500">無資料</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {monthReviews.map((r) => (
                <li key={r.id} className="px-5 py-3">
                  <Link
                    href={`/orders/${r.id}`}
                    className="flex items-center justify-between hover:bg-zinc-50 -mx-5 px-5"
                  >
                    <div>
                      <p className="font-mono text-xs text-zinc-500">
                        {r.order_code}
                      </p>
                      <p className="text-sm font-medium text-zinc-900">
                        {r.customer?.name ?? "—"}
                        {r.customer?.phone && (
                          <span className="ml-2 text-xs text-zinc-500">
                            {r.customer.phone}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-zinc-700">
                        {r.review_credited_to
                          ? techMap.get(r.review_credited_to)?.name ?? "（離職）"
                          : "—"}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {new Date(r.reviewed_at).toLocaleString("zh-TW")}
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
