#!/usr/bin/env node
// 清掉所有 OLD-* 前綴的 customers + orders（含 cascade）
// 用迴圈批次刪除以避免 1000 筆限制
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

async function purgeAll(table, codeCol, prefix) {
  let total = 0;
  while (true) {
    const { data, error } = await s.from(table).select("id").like(codeCol, `${prefix}%`).limit(500);
    if (error) { console.error(`select ${table}:`, error.message ?? error); break; }
    if (!data || data.length === 0) break;
    // 分批 delete 200 個一次（避免 URL 過長）
    for (let i = 0; i < data.length; i += 200) {
      const batch = data.slice(i, i + 200).map(x => x.id);
      const { error: dErr } = await s.from(table).delete().in("id", batch);
      if (dErr) { console.error(`delete ${table}:`, dErr.message ?? dErr); return total; }
      total += batch.length;
      process.stdout.write(`\r  ${table}: deleted ${total}`);
    }
  }
  process.stdout.write("\n");
  return total;
}

console.log("Purge OLD-* data...");
const orderCount = await purgeAll("orders", "order_code", "OLD-");
const custCount = await purgeAll("customers", "code", "OLD-");
console.log(`\nDone. orders=${orderCount}, customers=${custCount}`);
