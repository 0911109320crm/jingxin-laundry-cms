#!/usr/bin/env node
/**
 * 查 Supabase 現況 + 找指定電話的客戶
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

// === 1) 統計目前 DB 狀況 ===
console.log("=== Supabase 現況 ===");
for (const [table, label] of [
  ["customers", "客戶總數"],
  ["customer_phones", "電話總數"],
  ["customer_addresses", "地址總數"],
  ["machines", "機器總數"],
  ["orders", "訂單總數"],
  ["order_items", "品項總數"],
]) {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  console.log(`  ${label}: ${count}`);
}
console.log();

const { count: oldCount } = await supabase
  .from("customers").select("*", { count: "exact", head: true })
  .like("code", "OLD-%");
console.log(`  其中 OLD- 客戶: ${oldCount}\n`);

const { count: oldOrders } = await supabase
  .from("orders").select("*", { count: "exact", head: true })
  .like("order_code", "OLD-%");
console.log(`  其中 OLD- 訂單: ${oldOrders}\n`);

// === 2) 查 8 位新訂單客戶 ===
console.log("=== 查 5/25~5/28 新訂單的 8 位客戶 ===\n");
const queries = [
  { name: "邱先生",   phone: "0980867443" },
  { name: "陳先生",   phone: "0989217688" },
  { name: "賴秀鳳",   phone: "0911142680" },
  { name: "林先生",   phone: "0960666799" },
  { name: "陳品螢",   phone: "0915338031" },
  { name: "林怡鈞",   phone: "0988489309" },
  { name: "蕭育璋",   phone: "0906368029" },
  { name: "施小姐",   phone: "0920225301" },
];

for (const q of queries) {
  // 先用電話查
  const { data: byPhone } = await supabase
    .from("customer_phones").select("customer_id, phone")
    .eq("phone", q.phone);
  if (byPhone && byPhone.length > 0) {
    const cust = await supabase.from("customers").select("code, name, phone").eq("id", byPhone[0].customer_id).single();
    const { count: orderCnt } = await supabase
      .from("orders").select("*", { count: "exact", head: true })
      .eq("customer_id", byPhone[0].customer_id);
    console.log(`✅ ${q.name} (${q.phone}) → 已存在`);
    console.log(`   ${cust.data.code} | ${cust.data.name} | 主電話 ${cust.data.phone} | 歷史訂單 ${orderCnt} 筆`);
  } else {
    // 再用姓名 + 電話 trgm 模糊搜
    const { data: byName } = await supabase
      .from("customers").select("code, name, phone").eq("name", q.name).limit(5);
    if (byName && byName.length > 0) {
      console.log(`⚠ ${q.name} (${q.phone}) → 電話沒對到，但有同名客戶:`);
      for (const c of byName) console.log(`   ${c.code} | ${c.name} | ${c.phone}`);
    } else {
      console.log(`❌ ${q.name} (${q.phone}) → 不在資料庫`);
    }
  }
  console.log();
}
