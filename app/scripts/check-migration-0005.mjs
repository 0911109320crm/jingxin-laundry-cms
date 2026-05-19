#!/usr/bin/env node
// Diagnostic: verify migration 0005 (service_tags / service_notes) is applied.

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
    .map((l) => {
      const [k, ...r] = l.split("=");
      return [k.trim(), r.join("=").trim()];
    }),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

console.log("檢查 orders.service_tags / service_notes ...");
const a = await supabase.from("orders").select("id, service_tags, service_notes").limit(1);
if (a.error) console.log("  ❌ orders columns:", a.error.message);
else console.log("  ✅ orders columns exist");

console.log("\n檢查 service_tag_presets 表 ...");
const b = await supabase.from("service_tag_presets").select("id, label, active").limit(5);
if (b.error) console.log("  ❌ service_tag_presets:", b.error.message);
else console.log(`  ✅ service_tag_presets 存在，目前 ${b.data?.length ?? 0} 筆`);

console.log("\nDone.");
