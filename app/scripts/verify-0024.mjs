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
const vals = ["washing_vertical", "washing_twin_tub", "washing_drum", "ac_split", "ac_hidden"];
for (const v of vals) {
  const { error } = await s.from("machines").insert({ customer_id: "00000000-0000-0000-0000-000000000000", type: v });
  const msg = error?.message || "";
  if (/invalid input value for enum/i.test(msg)) console.log(`MISSING ${v}`);
  else console.log(`OK ${v} (enum accepted; insert rejected by ${error?.code || "?"})`);
}
