#!/usr/bin/env node
/**
 * 比對 production schema vs migrations 0001-0022 期望狀態
 * 列出缺少的 table / column，產出要 apply 的 migration 清單
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim()]; })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 每個 migration 的 telltale 欄位 / 表
const CHECKS = [
  { mig: "0002", desc: "結算狀態",         test: () => supabase.from("orders").select("settlement_status").limit(1) },
  { mig: "0003", desc: "訂單時段",         test: () => supabase.from("orders").select("scheduled_end_at, duration_minutes").limit(1) },
  { mig: "0004", desc: "訂單取消",         test: () => supabase.from("orders").select("cancellation_reason, cancelled_at").limit(1) },
  { mig: "0005", desc: "服務備註標籤",     test: () => supabase.from("orders").select("service_notes, service_tags").limit(1) },
  { mig: "0006", desc: "Google 五星追蹤",  test: () => supabase.from("service_tag_presets").select("id").limit(1) },
  { mig: "0007", desc: "機型品牌主檔",     test: () => supabase.from("machine_brands").select("id").limit(1) },
  { mig: "0008", desc: "促銷積分",         test: () => supabase.from("promotion_types").select("id").limit(1) },
  { mig: "0008b","desc": "order_promotions", test: () => supabase.from("order_promotions").select("id").limit(1) },
  { mig: "0009", desc: "標籤分機型分組",   test: () => supabase.from("service_tag_presets").select("category").limit(1) },
  { mig: "0010", desc: "53 真實價目",      test: async () => {
      const r = await supabase.from("service_items").select("code", { count: "exact" }).eq("code", "WV-S");
      return { error: r.error, found: (r.data?.length ?? 0) > 0 };
    } },
  { mig: "0011", desc: "system_settings",  test: () => supabase.from("system_settings").select("key").limit(1) },
  { mig: "0013", desc: "介紹人 customers.referrer_id", test: () => supabase.from("customers").select("referrer_id").limit(1) },
  { mig: "0013b", desc: "machines.address_id", test: () => supabase.from("machines").select("address_id").limit(1) },
  { mig: "0014", desc: "薪資抽成 service_items.commission_type", test: () => supabase.from("service_items").select("commission_type").limit(1) },
  { mig: "0014b", desc: "payroll_adjustments 表", test: () => supabase.from("payroll_adjustments").select("id").limit(1) },
  { mig: "0016", desc: "OLD-* 5 個 legacy service_items", test: async () => {
      const r = await supabase.from("service_items").select("code").like("code", "OLD-%");
      return { error: r.error, found: (r.data?.length ?? 0) >= 5, detail: `找到 ${r.data?.length ?? 0} 個` };
    } },
  { mig: "0017", desc: "customer_phones 多電話", test: () => supabase.from("customer_phones").select("id").limit(1) },
  { mig: "0018", desc: "legacy_code 清洗編號",  test: () => supabase.from("orders").select("legacy_code").limit(1) },
  { mig: "0019", desc: "machines.code",    test: () => supabase.from("machines").select("code").limit(1) },
  { mig: "0020", desc: "order_items.item_code", test: () => supabase.from("order_items").select("item_code").limit(1) },
  { mig: "0021", desc: "is_basic_choice + estimated_total", test: () => supabase.from("orders").select("estimated_total").limit(1) },
  { mig: "0021b", desc: "service_items.is_basic_choice", test: () => supabase.from("service_items").select("is_basic_choice").limit(1) },
  { mig: "0022", desc: "雙槽 WTUB",       test: async () => {
      const r = await supabase.from("service_items").select("code, category, is_basic_choice").eq("code", "WTUB");
      return { error: r.error, found: (r.data?.length ?? 0) > 0 };
    } },
];

console.log("=== Production schema 對齊度檢查 ===\n");
const missing = [];
for (const c of CHECKS) {
  try {
    const r = await c.test();
    const err = r.error;
    if (err) {
      console.log(`❌ ${c.mig}  ${c.desc.padEnd(25)} ${err.message}`);
      missing.push(c.mig);
    } else if (r.found === false) {
      console.log(`❌ ${c.mig}  ${c.desc.padEnd(25)} 表/欄存在但內容缺失 ${r.detail || ""}`);
      missing.push(c.mig);
    } else {
      console.log(`✅ ${c.mig}  ${c.desc.padEnd(25)} ${r.detail || "OK"}`);
    }
  } catch (e) {
    console.log(`❌ ${c.mig}  ${c.desc.padEnd(25)} ${e.message}`);
    missing.push(c.mig);
  }
}

console.log("\n=== 結論 ===");
if (missing.length === 0) {
  console.log("✅ 全部對齊，可以開始匯入");
} else {
  console.log(`❌ 缺 ${missing.length} 項：${missing.join(", ")}`);
  console.log("\n需要在 Supabase Dashboard 跑這些 migration:");
  const migFiles = [...new Set(missing.map(m => m.replace(/[a-z]$/, "")))].sort();
  for (const m of migFiles) {
    console.log(`  app/supabase/migrations/${m}_*.sql`);
  }
}
