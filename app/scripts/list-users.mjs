#!/usr/bin/env node
// 列出 Supabase 所有 auth users，方便執行清除前確認
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

const { data: au } = await supabase.auth.admin.listUsers({ perPage: 200 });
const { data: profiles } = await supabase.from("user_profiles").select("id, name, role, active");
const pMap = new Map((profiles ?? []).map(p => [p.id, p]));

console.log(`Auth users: ${au?.users?.length ?? 0}\n`);
for (const u of au?.users ?? []) {
  const p = pMap.get(u.id);
  console.log(`  ${(u.email ?? "(no email)").padEnd(45)} ${(p?.name ?? "(no profile)").padEnd(15)} ${(p?.role ?? "-").padEnd(11)} active=${p?.active ?? "-"}`);
}
