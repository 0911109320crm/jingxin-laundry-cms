#!/usr/bin/env node
// 把所有 OLD- 訂單的 settlement_status 改成 settled。
// 歷史訂單都已完成，不該出現在「師傅待回繳」清單。
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

const { data, error } = await supabase
  .from("orders")
  .update({ settlement_status: "settled" })
  .like("order_code", "OLD-%")
  .select("id");
if (error) { console.error(error); process.exit(1); }
console.log(`✓ updated ${data.length} OLD- orders → settled`);
