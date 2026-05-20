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

console.log("檢查 service_items 真實價目 + adjustment_items ...");

// service_items: 53 筆
const { data: items, error: e1, count: itemCount } = await supabase
  .from("service_items")
  .select("code, name, default_price, category", { count: "exact" });
if (e1) { console.log("  ❌ service_items:", e1.message); process.exit(1); }

const expectedCats = {
  washing_vertical: 5,
  washing_drum: 13,    // 6 一般 + 3 TW + 1 TW-LCD + 2 WT (老闆娘只給 17內 / 18-19，沒 20-21)
  sofa: 12,
  mattress: 14,
  ac_split: 5,
  ac_hidden: 5,
};
const got = items.reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + 1; return acc; }, {});
console.log(`  service_items 總筆數 ${itemCount}（預期 54）`);
for (const [cat, want] of Object.entries(expectedCats)) {
  const has = got[cat] || 0;
  console.log(`  ${has === want ? "✅" : "❌"} ${cat}: ${has} / ${want}`);
}

// 抽樣價格驗證
const samples = [
  ["WV-S", 1800],
  ["WD-L1", 4000],
  ["TW-LCD", 6800],
  ["SF-500", 5300],
  ["BD-D", 1500],
  ["BW-DXL", 3200],
  ["AC-S", 2500],
  ["AH-L", 3300],
];
console.log("  價格抽樣：");
for (const [code, price] of samples) {
  const row = items.find((i) => i.code === code);
  console.log(`    ${row && Number(row.default_price) === price ? "✅" : "❌"} ${code} = ${row?.default_price ?? "(missing)"} / ${price}`);
}

// adjustment_items: 3 舊 + 6 新 = 9
const { data: adj, error: e2 } = await supabase
  .from("adjustment_items")
  .select("name, default_amount, type");
if (e2) { console.log("  ❌ adjustment_items:", e2.message); process.exit(1); }
console.log(`  adjustment_items 總筆數 ${adj.length}（預期 9）`);
const adjSamples = [
  ["拆解費(內部拆不起/拆後不洗)", 300],
  ["遠距離車馬費", 400],
  ["無旋鈕全液晶螢幕", 300],
  ["上方有疊烘衣機(需移機)", 600],
  ["移機費", 600],
  ["卡軸/拆不起無法洗", 1000],
];
for (const [name, amount] of adjSamples) {
  const row = adj.find((a) => a.name === name);
  console.log(`    ${row && Number(row.default_amount) === amount ? "✅" : "❌"} ${name} = ${row?.default_amount ?? "(missing)"} / ${amount}`);
}
