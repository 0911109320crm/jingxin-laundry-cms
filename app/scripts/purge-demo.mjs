#!/usr/bin/env node
// 純清除 demo 資料：不會再 seed 回去
// - C2026-* 客戶 + 其訂單
// - sf001~sf004@jingxin.tw 員工
// - borenchang+manager@gmail.com 員工
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

console.log("=== Purge demo data ===\n");

// 1. C2026-* 客戶（cascade 會清 orders / items / addresses / machines）
const { data: custs } = await s.from("customers").select("id").like("code", "C2026-%");
const custIds = (custs ?? []).map(c => c.id);
console.log(`找到 ${custIds.length} 個 C2026-* 客戶`);
if (custIds.length) {
  // 先刪 orders（cascade 會清 items/adjustments）
  const { data: ords } = await s.from("orders").select("id").in("customer_id", custIds);
  if (ords?.length) {
    for (let i = 0; i < ords.length; i += 200) {
      const batch = ords.slice(i, i + 200).map(o => o.id);
      await s.from("orders").delete().in("id", batch);
    }
    console.log(`  刪除 ${ords.length} 筆 demo 訂單`);
  }
  // 再刪客戶
  for (let i = 0; i < custIds.length; i += 200) {
    await s.from("customers").delete().in("id", custIds.slice(i, i + 200));
  }
  console.log(`  刪除 ${custIds.length} 個 demo 客戶`);
}

// 2. demo 員工帳號
const demoEmails = [
  "sf001@jingxin.tw", "sf002@jingxin.tw", "sf003@jingxin.tw", "sf004@jingxin.tw",
  "borenchang+manager@gmail.com",
];
const { data: au } = await s.auth.admin.listUsers({ perPage: 200 });
for (const email of demoEmails) {
  const u = au?.users?.find(x => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) {
    console.log(`  (略過) ${email} 不存在`);
    continue;
  }
  await s.from("user_profiles").delete().eq("id", u.id);
  const { error } = await s.auth.admin.deleteUser(u.id);
  if (error) console.error(`  ✗ ${email}: ${error.message}`);
  else console.log(`  ✓ 刪除員工 ${email}`);
}

console.log("\nDone.");
