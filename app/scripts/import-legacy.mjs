#!/usr/bin/env node
/**
 * Step 3: 把 out/*.csv 灌進 Supabase。
 *
 * 用法:
 *   node import.mjs --dry-run         只統計、不寫入
 *   node import.mjs                   實際匯入（讀 migrate/out/）
 *   node import.mjs --clean           讀 migrate/out/clean/（10,891 筆可信客戶，第一批用這個）
 *   node import.mjs --reset           先刪除所有 OLD- 前綴客戶與訂單，再匯入
 *
 * 環境變數從 ../app/.env.local 讀取（SUPABASE_URL, SERVICE_ROLE_KEY）。
 *
 * 匯入順序:
 *   1. 確保 5 個 OLD-XX service_items 存在
 *   2. customers
 *   3. customer_addresses
 *   4. machines
 *   5. orders（暫時關閉 totals trigger 以保留 CSV 中的金額）
 *   6. order_items
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// app/scripts/ → app/.env.local
const envPath = resolve(__dirname, "..", ".env.local");
// app/scripts/ → ../../migrate/out/  或 ../../migrate/out/clean/
const USE_CLEAN = process.argv.includes("--clean");
const MIGRATE_OUT = USE_CLEAN
  ? resolve(__dirname, "..", "..", "migrate", "out", "clean")
  : resolve(__dirname, "..", "..", "migrate", "out");
if (!existsSync(envPath)) {
  console.error(`找不到 ${envPath}`);
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim()]; })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DRY_RUN = process.argv.includes("--dry-run");
const RESET = process.argv.includes("--reset");
const OUT = MIGRATE_OUT;
console.log(`讀取目錄: ${OUT}${USE_CLEAN ? " (clean 批，已過濾 126 筆問題客戶)" : ""}`);
// --sample N 或 --sample=N：只匯前 N 個客戶（及其關聯資料）
function parseSample(argv) {
  // --sample=10
  const eq = argv.find(a => a.startsWith("--sample="));
  if (eq) return parseInt(eq.split("=")[1], 10);
  // --sample 10
  const idx = argv.indexOf("--sample");
  if (idx >= 0 && argv[idx + 1] && /^\d+$/.test(argv[idx + 1])) {
    return parseInt(argv[idx + 1], 10);
  }
  return null;
}
const SAMPLE_N = parseSample(process.argv);

// ─── CSV parser ──────────────────────────────────────────────────────────────
function parseCSV(path) {
  const text = readFileSync(path, "utf-8").replace(/^﻿/, "");
  const rows = [];
  let cur = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { cur.push(cell); cell = ""; }
      else if (ch === "\n") { cur.push(cell); rows.push(cur); cur = []; cell = ""; }
      else if (ch === "\r") continue;
      else cell += ch;
    }
  }
  if (cell.length > 0 || cur.length > 0) { cur.push(cell); rows.push(cur); }
  const headers = rows[0];
  return rows.slice(1).filter(r => r.length === headers.length).map(r =>
    Object.fromEntries(r.map((v, i) => [headers[i], v]))
  );
}

// ─── legacy_code 清洗規則 ─────────────────────────────────────────────────────
// 老闆娘 2026-05-26 決策：
//   1. 民國年開頭（111-115，含各種 dash 變體 -/–/ー）→ 保留為 legacy_code
//   2. 英文字母前綴 (N/M/V/T/G/U/F/H/L/W/Q/I/WD...) → 舊版編碼系統，清掉
//   3. 其他（中文「拆不起/乾淨不洗/拆後背板/無」、數字怪格式 22-/21- 等）
//      → legacy_code 設 null，但把原值移到 order.note 保留資訊
const YEAR_PREFIX_RE = /^1[012]\d/;        // 民國 100-129 開頭
const LETTER_PREFIX_RE = /^[A-Za-z]/;       // 英文字母開頭
function classifyLegacyCode(raw) {
  const code = (raw || "").trim();
  if (!code) return { legacy_code: null, extra_note: "" };
  if (YEAR_PREFIX_RE.test(code)) return { legacy_code: code, extra_note: "" };
  if (LETTER_PREFIX_RE.test(code)) return { legacy_code: null, extra_note: "" };
  // 中文 / 數字怪格式 → 移到備註
  return { legacy_code: null, extra_note: `舊清洗編號欄: ${code}` };
}

// ─── Batch insert helper ─────────────────────────────────────────────────────
async function insertBatch(table, rows, batchSize = 500) {
  if (DRY_RUN) return rows.length;
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`  ${table} batch ${i}: ${error.message}`);
      fail += batch.length;
    } else {
      ok += batch.length;
    }
    process.stdout.write(`\r  ${table}: ${ok}/${rows.length}`);
  }
  process.stdout.write("\n");
  if (fail > 0) console.error(`  ${table}: ${fail} failed`);
  return ok;
}

// ─── 0. Reset ────────────────────────────────────────────────────────────────
// 分批刪：PostgREST 的 .in() 把 ID 塞 URL，超過上限會 silently truncate
async function deleteInBatches(table, ids, batchSize = 100) {
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { error } = await supabase.from(table).delete().in("id", batch);
    if (error) {
      console.error(`\n  ${table} batch ${i}: ${error.message}`);
      fail += batch.length;
    } else {
      ok += batch.length;
    }
    process.stdout.write(`\r  ${table}: ${ok}/${ids.length} (fail ${fail})`);
  }
  process.stdout.write("\n");
  return ok;
}

async function reset() {
  console.log("Reset mode: deleting all OLD- data...");
  // orders by order_code prefix
  const { data: oldOrders } = await supabase
    .from("orders").select("id").like("order_code", "OLD-%");
  const orderIds = (oldOrders ?? []).map(o => o.id);
  if (orderIds.length) {
    console.log(`  刪 ${orderIds.length} orders (cascade order_items / adjustments)...`);
    await deleteInBatches("orders", orderIds);
  }
  // customers by code prefix
  const { data: oldCusts } = await supabase
    .from("customers").select("id").like("code", "OLD-%");
  const custIds = (oldCusts ?? []).map(c => c.id);
  if (custIds.length) {
    console.log(`  刪 ${custIds.length} customers (cascade phones / addresses / machines)...`);
    await deleteInBatches("customers", custIds);
  }
  console.log("Reset done.\n");
}

// ─── 1. Service items ────────────────────────────────────────────────────────
async function ensureServiceItems() {
  console.log("確認 5 個 OLD-XX service_items...");
  const items = [
    { code: "OLD-WASHER-VERTICAL", name: "舊資料-直立式洗衣機", default_price: 1600, category: "washing_vertical", sort_order: 9001 },
    { code: "OLD-WASHER-DRUM",     name: "舊資料-滾筒洗衣機",   default_price: 3800, category: "washing_drum",     sort_order: 9002 },
    { code: "OLD-AC",              name: "舊資料-冷氣",         default_price: 2500, category: "ac_split",         sort_order: 9003 },
    { code: "OLD-MATTRESS",        name: "舊資料-床墊",         default_price: 1800, category: "mattress",         sort_order: 9004 },
    { code: "OLD-SOFA",            name: "舊資料-沙發",         default_price: 2500, category: "sofa",             sort_order: 9005 },
  ];
  if (!DRY_RUN) {
    const { error } = await supabase.from("service_items").upsert(items, { onConflict: "code" });
    if (error) { console.error("  service_items:", error.message); process.exit(1); }
  }
  const { data } = await supabase.from("service_items").select("id, code").in("code", items.map(i => i.code));
  const map = new Map((data ?? []).map(r => [r.code, r.id]));
  for (const it of items) {
    console.log(`  ${it.code.padEnd(22)} → ${map.get(it.code) ?? "(dry-run)"}`);
  }
  return map;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== Import to Supabase (${DRY_RUN ? "DRY-RUN" : "LIVE"}) ===\n`);

  if (RESET && !DRY_RUN) await reset();

  let customers = parseCSV(resolve(OUT, "customers.csv"));
  let phones    = parseCSV(resolve(OUT, "customer_phones.csv"));
  let addresses = parseCSV(resolve(OUT, "customer_addresses.csv"));
  let machines  = parseCSV(resolve(OUT, "machines.csv"));
  let orders    = parseCSV(resolve(OUT, "orders.csv"));
  let items     = parseCSV(resolve(OUT, "order_items.csv"));

  if (SAMPLE_N) {
    // --sample-multiphone: 優先挑有副電話的客戶
    if (process.argv.includes("--sample-multiphone")) {
      const phoneCount = new Map();
      for (const p of phones) phoneCount.set(p.customer_id, (phoneCount.get(p.customer_id) ?? 0) + 1);
      customers = customers.filter(c => (phoneCount.get(c.id) ?? 0) >= 2).slice(0, SAMPLE_N);
    } else {
      customers = customers.slice(0, SAMPLE_N);
    }
    const custIds = new Set(customers.map(c => c.id));
    phones    = phones.filter(p => custIds.has(p.customer_id));
    addresses = addresses.filter(a => custIds.has(a.customer_id));
    machines  = machines.filter(m => custIds.has(m.customer_id));
    orders    = orders.filter(o => custIds.has(o.customer_id));
    const orderIds = new Set(orders.map(o => o.id));
    items     = items.filter(it => orderIds.has(it.order_id));
    console.log(`\n--sample=${SAMPLE_N}: 只匯 ${customers.length} 個客戶相關資料\n`);
  }

  console.log(`輸入:`);
  console.log(`  customers:           ${customers.length}`);
  console.log(`  customer_phones:     ${phones.length}`);
  console.log(`  customer_addresses:  ${addresses.length}`);
  console.log(`  machines:            ${machines.length}`);
  console.log(`  orders:              ${orders.length}`);
  console.log(`  order_items:         ${items.length}\n`);

  const svcMap = await ensureServiceItems();

  // customers
  console.log("\n1) customers");
  await insertBatch("customers", customers.map(c => ({
    id: c.id,
    code: c.code,
    name: c.name || "（舊資料-無姓名）",
    phone: c.phone,
    joined_at: c.joined_at || null,
    note: c.note || null,
  })));

  // customer_phones（先擋 trigger：每客戶最多 1 個 primary，故主電話先進、副電話後進）
  console.log("\n1b) customer_phones");
  await insertBatch("customer_phones", phones.map(p => ({
    id: p.id,
    customer_id: p.customer_id,
    phone: p.phone,
    label: p.label || null,
    is_primary: p.is_primary === "true",
    sort_order: parseInt(p.sort_order, 10),
  })));

  // addresses
  console.log("\n2) customer_addresses");
  await insertBatch("customer_addresses", addresses.map(a => ({
    id: a.id,
    customer_id: a.customer_id,
    county: a.county,
    district: a.district,
    address: a.address,
    label: a.label || null,
    is_default: a.is_default === "true",
  })));

  // machines
  console.log("\n3) machines");
  await insertBatch("machines", machines.map(m => ({
    id: m.id,
    customer_id: m.customer_id,
    address_id: m.address_id || null,
    type: m.type,
    brand: m.brand || null,
    model: m.model || null,
    sub_type: m.sub_type || null,
    note: m.note || null,
  })));

  // orders
  // 注意：
  //   1. order_items insert 會觸發 refresh_order_totals 把 orders.subtotal/total 重算。
  //      因為 CSV 中的金額 = sum(items.unit_price)，重算後仍會吻合，所以不必關 trigger。
  //   2. 歷史訂單都已完成，settlement_status 強制設 'settled'，否則 init_settlement
  //      trigger 會根據 cash → 設成 'pending'（待回繳），出現在師傅待回繳清單。
  console.log("\n4) orders");
  // legacy_code 清洗統計
  let n_keep = 0, n_drop_letter = 0, n_moved_to_note = 0;
  const orderRows = orders.map(o => {
    const { legacy_code, extra_note } = classifyLegacyCode(o.legacy_code);
    if (o.legacy_code) {
      if (legacy_code) n_keep++;
      else if (extra_note) n_moved_to_note++;
      else n_drop_letter++;
    }
    const finalNote = [o.note, extra_note].filter(Boolean).join(" | ");
    return {
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
      note: finalNote || null,
      legacy_code,
    };
  });
  console.log(`   legacy_code 清洗: 保留 ${n_keep} / 清字母前綴 ${n_drop_letter} / 移到 note ${n_moved_to_note}`);
  await insertBatch("orders", orderRows);

  // order_items
  console.log("\n5) order_items");
  await insertBatch("order_items", items.map(it => ({
    id: it.id,
    order_id: it.order_id,
    machine_id: it.machine_id || null,
    service_item_id: svcMap.get(it.service_code),
    technician_id: it.technician_id || null,
    quantity: parseInt(it.quantity, 10),
    unit_price: parseFloat(it.unit_price),
    subtotal: parseFloat(it.subtotal),
    tag: it.tag || null,
    note: it.note || null,
  })));

  console.log("\n=== Done ===");
}

main().catch(e => { console.error(e); process.exit(1); });
