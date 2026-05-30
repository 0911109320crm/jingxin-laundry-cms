#!/usr/bin/env node
// 套用 + 驗證 0023：basic_choice 代表項改純中文品名、WTUB 取消 basic_choice。
// 全部是 DML(update)，可用 supabase-js query builder 直接跑。
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

const renames = [
  ["WV-S", "直立式洗衣機"],
  ["WD-L1", "滾筒式洗衣機"],
  ["AC-S", "分離式冷氣"],
  ["AH-S", "吊隱式冷氣"],
  ["SF-100", "沙發"],
  ["BD-S", "床墊除蟎"],
  ["BW-S", "床墊清洗"],
];

for (const [code, name] of renames) {
  const { error } = await s.from("service_items")
    .update({ name, is_basic_choice: true }).eq("code", code);
  console.log(error ? `FAIL ${code} → ${error.message}` : `OK   ${code} → ${name}`);
}

const { error: wtubErr } = await s.from("service_items")
  .update({ is_basic_choice: false }).eq("code", "WTUB");
console.log(wtubErr ? `FAIL WTUB → ${wtubErr.message}` : "OK   WTUB → is_basic_choice=false");

// 驗證：列出目前所有 basic_choice
const { data: basics } = await s.from("service_items")
  .select("code, name, default_price, category, is_basic_choice")
  .eq("is_basic_choice", true).order("sort_order");
console.log("\n建單下拉現有選項：");
for (const b of basics ?? []) {
  console.log(`  - ${b.name}（NT$${b.default_price}）  [${b.code}]`);
}
const codes = (basics ?? []).map(b => b.code).sort().join(",");
const expected = ["WV-S","WD-L1","AC-S","AH-S","SF-100","BD-S","BW-S"].sort().join(",");
console.log(codes === expected ? "\nPASS 7 個選項正確" : `\nWARN 選項不符\n  got: ${codes}\n  exp: ${expected}`);
