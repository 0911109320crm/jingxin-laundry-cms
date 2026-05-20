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

console.log("檢查 service_tag_presets 按機型分組 ...");
const { data, error, count } = await supabase
  .from("service_tag_presets")
  .select("category, label", { count: "exact" });
if (error) { console.log("  ❌", error.message); process.exit(1); }

const expected = {
  washing_vertical: 14,
  washing_drum: 14,
  ac_split: 12,
  mattress: 12,
};
const got = data.reduce((acc, r) => { acc[r.category || "(null)"] = (acc[r.category || "(null)"] || 0) + 1; return acc; }, {});
console.log(`  總筆數 ${count}（預期 52）`);
for (const [cat, want] of Object.entries(expected)) {
  const has = got[cat] || 0;
  console.log(`  ${has === want ? "✅" : "❌"} ${cat}: ${has} / ${want}`);
}
const nullCount = got["(null)"] || 0;
if (nullCount > 0) console.log(`  ⚠️ 有 ${nullCount} 筆 category=NULL（舊資料殘留？）`);
