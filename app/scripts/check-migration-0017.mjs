#!/usr/bin/env node
// 驗證 0017_customer_phones.sql 套用成功
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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

// 1. table 存在
const { error: tErr } = await supabase.from("customer_phones").select("id").limit(1);
console.log(tErr ? `❌ customer_phones 表不存在: ${tErr.message}` : "✅ customer_phones 表存在");
if (tErr) process.exit(1);

// 2. backfill 完成（每個有 phone 的 customer 都應該有 1 筆 primary phone）
const { count: custCount } = await supabase.from("customers")
  .select("id", { count: "exact", head: true }).not("phone", "is", null).neq("phone", "");
const { count: phoneCount } = await supabase.from("customer_phones")
  .select("id", { count: "exact", head: true }).eq("is_primary", true);
console.log(`customers 有 phone: ${custCount}`);
console.log(`customer_phones primary: ${phoneCount}`);
if (custCount === phoneCount) {
  console.log("✅ backfill 正確（每客戶 1 個 primary）");
} else {
  console.log(`⚠ 差 ${custCount - phoneCount} 筆，可能 backfill 不完整或多支電話客戶尚未匯入`);
}

// 3. trigger 測試：把某客戶 primary phone 改寫，customers.phone 是否同步
const { data: testCust } = await supabase.from("customers").select("id, phone").limit(1).single();
if (testCust) {
  const newPhone = testCust.phone + "X";
  const { data: pr } = await supabase.from("customer_phones")
    .select("id").eq("customer_id", testCust.id).eq("is_primary", true).single();
  if (pr) {
    await supabase.from("customer_phones").update({ phone: newPhone }).eq("id", pr.id);
    const { data: after } = await supabase.from("customers").select("phone").eq("id", testCust.id).single();
    if (after.phone === newPhone) {
      console.log("✅ trigger 正常（primary 變更會同步到 customers.phone）");
    } else {
      console.log(`❌ trigger 沒運作：customers.phone=${after.phone}，預期 ${newPhone}`);
    }
    // 還原
    await supabase.from("customer_phones").update({ phone: testCust.phone }).eq("id", pr.id);
  }
}
