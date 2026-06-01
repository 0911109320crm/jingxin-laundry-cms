import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8")
    .split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim()]; }));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function col(table, column) {
  const { error } = await s.from(table).select(column).limit(1);
  if (!error) return `OK   ${table}.${column}`;
  if (/does not exist|could not find/i.test(error.message)) return `MISSING ${table}.${column} → ${error.message}`;
  return `?    ${table}.${column} → ${error.message}`;
}
console.log(await col("order_items", "excluded"));        // 0023_order_items_excluded
console.log(await col("orders", "collected_by_technician_id")); // 0024_order_collected_by
console.log(await col("order_items", "confirmed"));        // 0025_order_item_amount_confirmed

// machine_type enum probe
for (const v of ["washing_vertical", "ac_split"]) {
  const { error } = await s.from("machines").insert({ customer_id: "00000000-0000-0000-0000-000000000000", type: v });
  console.log(/invalid input value for enum/i.test(error?.message || "")
    ? `MISSING machine_type '${v}'` : `OK   machine_type '${v}' (enum accepted)`);
}
