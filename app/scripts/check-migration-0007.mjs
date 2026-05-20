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

console.log("檢查 machine_brands 表 + seed ...");

const { data, error, count } = await supabase
  .from("machine_brands")
  .select("category, name", { count: "exact" })
  .eq("active", true);

if (error) {
  console.log("  ❌", error.message);
  process.exit(1);
}

const expected = {
  washing_vertical: 15,
  washing_drum: 11,
  ac_split: 16,
  ac_hidden: 9,
};
const got = data.reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + 1; return acc; }, {});
console.log(`  總筆數 ${count}（預期 51）`);
for (const [cat, want] of Object.entries(expected)) {
  const has = got[cat] || 0;
  const ok = has === want ? "✅" : "❌";
  console.log(`  ${ok} ${cat}: ${has} / ${want}`);
}
