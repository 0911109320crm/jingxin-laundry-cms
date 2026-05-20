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

console.log("檢查 system_settings + customer_sources 細化 ...");

// system_settings.monthly_promotion_kpi
const { data: s, error: e1 } = await supabase
  .from("system_settings")
  .select("value")
  .eq("key", "monthly_promotion_kpi")
  .maybeSingle();
if (e1) { console.log("  ❌ system_settings:", e1.message); process.exit(1); }
console.log(`  ${s?.value === 3 ? "✅" : "❌"} monthly_promotion_kpi = ${s?.value ?? "(missing)"} / 3`);

// customer_sources: 應該有「FB 地方社團」
const { data: srcs, error: e2 } = await supabase
  .from("customer_sources")
  .select("name");
if (e2) { console.log("  ❌ customer_sources:", e2.message); process.exit(1); }
const hasNew = srcs.some((s) => s.name === "FB 地方社團");
console.log(`  ${hasNew ? "✅" : "❌"} 「FB 地方社團」來源已加入`);
