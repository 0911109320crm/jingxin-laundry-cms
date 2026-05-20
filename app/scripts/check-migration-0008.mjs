#!/usr/bin/env node
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

console.log("檢查 promotion_types + order_promotions ...");

// 1. promotion_types 9 種
const { data: types, error: e1 } = await supabase
  .from("promotion_types")
  .select("code, label, points");
if (e1) { console.log("  ❌ promotion_types:", e1.message); process.exit(1); }

const expected = [
  ["fb_like_jingxin", 1], ["fb_comment_jingxin", 1], ["fb_checkin_jingxin", 1],
  ["fb_checkin_jingxin_tag2", 2], ["fb_like_jielixin", 2], ["fb_comment_jielixin", 1],
  ["google_5star", 1], ["google_5star_photo", 2], ["local_group_post", 2],
];
console.log(`  promotion_types: ${types.length} 筆（預期 9）`);
for (const [code, pts] of expected) {
  const row = types.find((t) => t.code === code);
  const ok = row && row.points === pts;
  console.log(`  ${ok ? "✅" : "❌"} ${code}: points=${row?.points ?? "(missing)"} / ${pts}`);
}

// 2. order_promotions 表存在
const { error: e2 } = await supabase.from("order_promotions").select("id").limit(0);
console.log(`  ${e2 ? "❌" : "✅"} order_promotions 表存在${e2 ? ": " + e2.message : ""}`);

// 3. orders.got_5star_review 應已移除（select 該欄會失敗）
const { error: e3 } = await supabase.from("orders").select("got_5star_review").limit(1);
console.log(`  ${e3 ? "✅" : "❌"} orders.got_5star_review 已移除${e3 ? "" : "（還在！）"}`);
