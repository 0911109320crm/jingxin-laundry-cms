#!/usr/bin/env node
/** 試 insert 1 筆 order，把錯誤訊息打出來 */
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

// 讀第一筆 OLD- 訂單試試
const csv = readFileSync(resolve(__dirname, "..", "..", "migrate", "out", "clean", "orders.csv"), "utf-8");
const lines = csv.split(/\r?\n/);
const header = lines[0].split(",");
const firstRow = lines[1].split(",");
const o = Object.fromEntries(header.map((h, i) => [h, firstRow[i]]));

console.log("試 insert 一筆訂單:", o.order_code);
console.log("customer_id:", o.customer_id);
console.log("address_id:", o.address_id);

const payload = {
  id: o.id,
  order_code: o.order_code,
  customer_id: o.customer_id,
  address_id: o.address_id,
  scheduled_at: o.scheduled_at || null,
  service_at: o.service_at || null,
  status: o.status,
  payment_method: o.payment_method || null,
  settlement_status: "settled",
  subtotal: parseFloat(o.subtotal),
  adjustments_total: parseFloat(o.adjustments_total),
  total: parseFloat(o.total),
  source: o.source || null,
  note: o.note || null,
  legacy_code: o.legacy_code || null,
};
console.log("payload:", JSON.stringify(payload, null, 2));

const { data, error } = await supabase.from("orders").insert(payload).select();
if (error) {
  console.error("\n❌ 錯誤:", error.message);
  console.error("詳細:", JSON.stringify(error, null, 2));
} else {
  console.log("\n✅ 成功:", data);
}
