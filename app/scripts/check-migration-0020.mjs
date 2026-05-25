#!/usr/bin/env node
// 驗證 0020_legacy_codes_and_item_codes.sql 套用成功
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

let pass = 0, fail = 0;
function check(ok, msg) {
  if (ok) { console.log("✅", msg); pass++; }
  else { console.log("❌", msg); fail++; }
}

// 1. orders.legacy_code 欄位存在
const { error: e1 } = await s.from("orders").select("legacy_code").limit(1);
check(!e1, `orders.legacy_code 欄位存在 ${e1 ? "→ " + e1.message : ""}`);

// 2. order_items.item_code 欄位存在
const { error: e2 } = await s.from("order_items").select("item_code").limit(1);
check(!e2, `order_items.item_code 欄位存在 ${e2 ? "→ " + e2.message : ""}`);

// 3. machine_brands 每個 category 都有「(未知)」
const { data: brands } = await s.from("machine_brands").select("category, name").eq("name", "(未知)");
const cats = new Set((brands ?? []).map(b => b.category));
const required = ["washing_vertical", "washing_drum", "ac_split", "ac_hidden", "mattress", "sofa"];
const missing = required.filter(c => !cats.has(c));
check(missing.length === 0, `machine_brands 6 個 category 都有「(未知)」${missing.length ? "→ 缺 " + missing.join(",") : ""}`);

// 4. service_items 6 個「(待補)」存在
const { data: items } = await s.from("service_items").select("code").like("code", "TBD-%");
check((items ?? []).length === 6, `service_items 有 6 個 TBD-* 項目 (實際 ${(items ?? []).length})`);

// 5. trigger 測試：建立測試 order 跟 items，看是否自動編號
console.log("\n--- trigger 測試 ---");
const { data: anyCust } = await s.from("customers").select("id").limit(1).single();
if (!anyCust) {
  console.log("⚠ 沒有任何客戶，跳過 trigger 測試");
} else {
  const { data: anyAddr } = await s.from("customer_addresses")
    .select("id").eq("customer_id", anyCust.id).limit(1).single();
  const { data: anySvc } = await s.from("service_items").select("id").limit(1).single();
  const testCode = `TEST-${Date.now()}`;
  const { data: order, error: oErr } = await s.from("orders").insert({
    order_code: testCode,
    customer_id: anyCust.id,
    address_id: anyAddr?.id,
    status: "pending",
  }).select("id").single();
  if (oErr) {
    console.log("⚠ 測試訂單建立失敗：", oErr.message);
  } else {
    // 插 3 個 items（用迴圈確保 created_at 順序）
    for (let i = 0; i < 3; i++) {
      await s.from("order_items").insert({
        order_id: order.id,
        service_item_id: anySvc.id,
        quantity: 1,
        unit_price: 100,
        subtotal: 100,
      });
      await new Promise(r => setTimeout(r, 10));
    }
    const { data: created } = await s.from("order_items")
      .select("item_code").eq("order_id", order.id).order("created_at");
    const codes = (created ?? []).map(c => c.item_code).sort();
    const expected = [`${testCode}-1`, `${testCode}-2`, `${testCode}-3`].sort();
    const match = JSON.stringify(codes) === JSON.stringify(expected);
    check(match, `自動編號正確 (得到 ${JSON.stringify(codes)})`);
    await s.from("orders").delete().eq("id", order.id);
  }
}

console.log(`\n結果: ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
