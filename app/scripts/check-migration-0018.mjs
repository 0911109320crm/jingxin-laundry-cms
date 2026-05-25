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

console.log("檢查 0018 訂單 duration_minutes 欄位 ...");

const { data, error } = await supabase
  .from("orders")
  .select("id, duration_minutes")
  .limit(1);
if (error) { console.log("  ❌ orders.duration_minutes:", error.message); process.exit(1); }
console.log(`  ✅ orders.duration_minutes 欄位存在`);

if (data?.[0]) {
  console.log(`  ✅ 範例值：${data[0].duration_minutes} 分`);
}
