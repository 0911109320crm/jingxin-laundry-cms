#!/usr/bin/env node
/**
 * 回滾：把 orders.note 還原成 .backups/orders-note-before-cleanup.json 的內容
 * 用法：node scripts/restore-notes.mjs
 */
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

const rows = JSON.parse(
  readFileSync(resolve(__dirname, "..", ".backups", "orders-note-before-cleanup.json"), "utf-8")
);
console.log(`restoring ${rows.length} notes...`);
let done = 0;
for (const r of rows) {
  const { error } = await supabase.from("orders").update({ note: r.note }).eq("id", r.id);
  if (error) { console.error(r.id, error.message); process.exit(1); }
  if (++done % 1000 === 0) console.log(`  ${done}/${rows.length}`);
}
console.log(`restored ${done} notes.`);
