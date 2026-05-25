#!/usr/bin/env node
// 驗證 0021_basic_choice_and_estimated_total.sql 套用成功
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8")
    .split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim()]; })
);
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
function check(ok, msg) {
  if (ok) { console.log("OK", msg); pass++; }
  else { console.log("FAIL", msg); fail++; }
}

// 1. service_items.is_basic_choice 欄位存在
const { error: e1 } = await s.from("service_items").select("is_basic_choice").limit(1);
check(!e1, `service_items.is_basic_choice 欄位存在 ${e1 ? "→ " + e1.message : ""}`);

// 2. 每個 category 都恰好 1 個 is_basic_choice=true
const { data: basics } = await s.from("service_items")
  .select("code, category, default_price")
  .eq("is_basic_choice", true)
  .order("category");
const expected = new Set(["washing_vertical", "washing_drum", "sofa", "mattress", "ac_split", "ac_hidden"]);
const cats = new Map();
for (const b of basics ?? []) {
  cats.set(b.category, (cats.get(b.category) ?? 0) + 1);
}
const missing = [...expected].filter(c => !cats.has(c));
const dup = [...cats.entries()].filter(([, n]) => n > 1).map(([c]) => c);
check(missing.length === 0 && dup.length === 0,
  `6 個 category 各標 1 個 basic_choice ${missing.length ? "→ 缺 " + missing.join(",") : ""}${dup.length ? "→ 重複 " + dup.join(",") : ""}`);

console.log("\n基本價清單：");
for (const b of basics ?? []) {
  console.log(`  ${b.category.padEnd(20)} ${b.code.padEnd(8)} $${b.default_price}`);
}

// 3. orders.estimated_total 欄位存在
const { error: e3 } = await s.from("orders").select("estimated_total").limit(1);
check(!e3, `orders.estimated_total 欄位存在 ${e3 ? "→ " + e3.message : ""}`);

// 4. 既有訂單 estimated_total 都已回填
const { count: missingCnt } = await s.from("orders")
  .select("*", { count: "exact", head: true })
  .is("estimated_total", null);
check((missingCnt ?? 0) === 0, `既有訂單 estimated_total 都已回填 (缺 ${missingCnt ?? 0} 筆)`);

console.log(`\n結果: ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
