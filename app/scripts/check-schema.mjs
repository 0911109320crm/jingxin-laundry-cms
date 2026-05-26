#!/usr/bin/env node
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

// 直接用 PostgREST 試取一筆 orders 看回來的欄位
const { data, error } = await supabase.from("orders").select("*").limit(1);
if (error) { console.error(error); process.exit(1); }
if (data.length === 0) {
  // 空表，select 假欄位看錯誤
  const r = await supabase.from("orders").select("id, legacy_code").limit(1);
  console.log("legacy_code 試 select 結果:", r.error ?? "OK");
  process.exit(0);
}
console.log("orders 第一筆 keys:", Object.keys(data[0]).sort().join(", "));
console.log("\n有 legacy_code 欄位?", "legacy_code" in data[0]);
