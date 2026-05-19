#!/usr/bin/env node
/**
 * Seed sample Google review marks on done orders (for demo).
 *
 * 隨機挑 ~30% 已完成且有派工的訂單標記為 got_5star_review，歸屬給該筆訂單第一位師傅。
 * reviewed_at 設在訂單 service_at 後 1-7 天內隨機。
 *
 * Usage:
 *   node scripts/seed-reviews.mjs           # 加標記（已標記的會跳過）
 *   node scripts/seed-reviews.mjs --reset   # 清空後重新標記
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim()]; }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RESET = process.argv.includes("--reset");
const REVIEW_RATIO = 0.3;

async function main() {
  if (RESET) {
    console.log("Resetting all review marks...");
    const { error } = await supabase
      .from("orders")
      .update({ got_5star_review: false, reviewed_at: null, review_credited_to: null })
      .eq("got_5star_review", true);
    if (error) { console.error(error); process.exit(1); }
  }

  console.log("Loading done orders with at least one assigned technician...");
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, service_at, scheduled_at, got_5star_review, items:order_items(technician_id, created_at)")
    .eq("status", "done")
    .eq("got_5star_review", false)
    .limit(2000);
  if (error) { console.error(error); process.exit(1); }

  const eligible = (orders ?? []).filter((o) => {
    const techs = (o.items ?? []).filter((it) => it.technician_id);
    return techs.length > 0;
  });
  console.log(`  ${eligible.length} eligible orders`);

  const picks = eligible.filter(() => Math.random() < REVIEW_RATIO);
  console.log(`  randomly picked ${picks.length} (~${Math.round(REVIEW_RATIO*100)}%)`);

  let done = 0;
  for (const o of picks) {
    const sortedItems = (o.items ?? [])
      .filter((it) => it.technician_id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const credited = sortedItems[0]?.technician_id;
    if (!credited) continue;

    const baseStr = o.service_at ?? o.scheduled_at;
    const base = baseStr ? new Date(baseStr) : new Date();
    base.setDate(base.getDate() + 1 + Math.floor(Math.random() * 7));
    const reviewedAt = base.toISOString();

    const { error: upErr } = await supabase
      .from("orders")
      .update({
        got_5star_review: true,
        reviewed_at: reviewedAt,
        review_credited_to: credited,
      })
      .eq("id", o.id);
    if (upErr) console.error(`  fail ${o.id}: ${upErr.message}`);
    else done++;
  }
  console.log(`\n✓ Marked ${done} orders as having 5-star review.`);

  const { data: counts } = await supabase
    .from("orders")
    .select("review_credited_to")
    .eq("got_5star_review", true);
  const tally = new Map();
  for (const r of (counts ?? [])) {
    tally.set(r.review_credited_to, (tally.get(r.review_credited_to) ?? 0) + 1);
  }
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, name")
    .in("id", Array.from(tally.keys()));
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.name]));
  console.log("\nLeaderboard (all-time):");
  for (const [id, n] of Array.from(tally.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${(nameMap.get(id) ?? "—").padEnd(10)} ${n} 次`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
