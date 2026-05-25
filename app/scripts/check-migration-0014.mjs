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

console.log("檢查 0014 薪資抽成系統 ...");

// 1) service_items 新欄位
const { data: si, error: e1 } = await supabase
  .from("service_items")
  .select("commission_type, commission_value")
  .limit(1);
if (e1) { console.log("  ❌ service_items 抽成欄位:", e1.message); process.exit(1); }
console.log(`  ✅ service_items 加 commission_type / commission_value`);

// 2) adjustment_items 新欄位
const { data: ai, error: e2 } = await supabase
  .from("adjustment_items")
  .select("name, affects_commission");
if (e2) { console.log("  ❌ adjustment_items 抽成欄位:", e2.message); process.exit(1); }
console.log(`  ✅ adjustment_items 加 affects_commission`);
const discount = ai.find((a) => a.name === "折扣");
console.log(`  ${discount?.affects_commission === false ? "✅" : "❌"} 「折扣」affects_commission = ${discount?.affects_commission} (應為 false)`);

// 3) payroll_adjustments 表
const { error: e3 } = await supabase.from("payroll_adjustments").select("id").limit(1);
console.log(`  ${e3 ? "❌" : "✅"} payroll_adjustments 表存在${e3 ? `: ${e3.message}` : ""}`);

// 4) payroll_snapshots 表
const { error: e4 } = await supabase.from("payroll_snapshots").select("id").limit(1);
console.log(`  ${e4 ? "❌" : "✅"} payroll_snapshots 表存在${e4 ? `: ${e4.message}` : ""}`);

// 5) system_settings 預設抽成
const keys = ["default_commission_type", "default_commission_value", "payroll_kpi_disclaimer"];
const { data: settings } = await supabase
  .from("system_settings")
  .select("key, value")
  .in("key", keys);
for (const k of keys) {
  const row = settings?.find((s) => s.key === k);
  console.log(`  ${row ? "✅" : "❌"} system_settings.${k} = ${row ? JSON.stringify(row.value) : "(missing)"}`);
}
