#!/usr/bin/env node
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

const query = "114C-C089";
console.log(`Searching for: "${query}"\n`);

// 1. 直接 find by exact match
const { data: exact } = await supabase.from("orders")
  .select("id, order_code, legacy_code, customer_id")
  .eq("legacy_code", query);
console.log(`1. exact eq match: ${exact?.length ?? 0} rows`);
exact?.forEach(o => console.log(`   ${o.order_code} | legacy=${o.legacy_code}`));

// 2. ilike with wildcard
const { data: ilike } = await supabase.from("orders")
  .select("id, order_code, legacy_code")
  .ilike("legacy_code", `%${query}%`);
console.log(`\n2. ilike '%${query}%': ${ilike?.length ?? 0} rows`);
ilike?.forEach(o => console.log(`   ${o.order_code} | legacy=${o.legacy_code}`));

// 3. 模擬實際 globalSearch 用的 .or() 寫法
const like = `%${query}%`;
const { data: orQuery, error: orErr } = await supabase.from("orders")
  .select("id, order_code, legacy_code, customers(name)")
  .or(`order_code.ilike.${like},note.ilike.${like},legacy_code.ilike.${like}`)
  .limit(8);
console.log(`\n3. .or() 寫法（同 globalSearch）: ${orQuery?.length ?? 0} rows`);
if (orErr) console.log("   ERR:", orErr.message);
orQuery?.forEach(o => console.log(`   ${o.order_code} | legacy=${o.legacy_code}`));
