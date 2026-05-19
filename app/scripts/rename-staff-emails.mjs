#!/usr/bin/env node
/**
 * One-shot: rename existing technician demo accounts to sf001~sf004 format.
 *
 * Why a separate script: running `seed-demo.mjs --reset` would wipe all demo
 * orders/customers too. This only updates the auth.users.email of the 4 staff,
 * preserving order_items.technician_id linkage (because auth uid stays same).
 *
 * Usage: node scripts/rename-staff-emails.mjs
 */

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

const RENAMES = [
  { from: "borenchang+wang@gmail.com",  to: "sf001@jingxin.tw" },
  { from: "borenchang+lin@gmail.com",   to: "sf002@jingxin.tw" },
  { from: "borenchang+chen@gmail.com",  to: "sf003@jingxin.tw" },
  { from: "borenchang+huang@gmail.com", to: "sf004@jingxin.tw" },
];

async function findUserByEmail(email) {
  // listUsers paginates; for <100 users one page is enough
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function main() {
  console.log("Renaming staff emails...\n");
  for (const r of RENAMES) {
    const u = await findUserByEmail(r.from);
    if (!u) {
      console.log(`  ? ${r.from} not found — skipped`);
      continue;
    }
    // Check if target already exists (re-run safety)
    const target = await findUserByEmail(r.to);
    if (target && target.id !== u.id) {
      console.log(`  ! ${r.to} already exists (different uid) — skipped`);
      continue;
    }
    const { error } = await supabase.auth.admin.updateUserById(u.id, {
      email: r.to,
      email_confirm: true,
    });
    if (error) console.log(`  X ${r.from} → ${r.to}  FAILED: ${error.message}`);
    else console.log(`  ✓ ${r.from}  →  ${r.to}`);
  }
  console.log("\nDone. Password unchanged (admin1234).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
