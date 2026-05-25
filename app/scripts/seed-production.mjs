#!/usr/bin/env node
/**
 * 正式上線員工帳號 seed。
 *
 * 用法:
 *   node scripts/seed-production.mjs            ─ 建立帳號（已存在則略過）
 *   node scripts/seed-production.mjs --reset    ─ 先刪除所有 production 帳號再重建
 *   node scripts/seed-production.mjs --dry-run  ─ 只列出，不寫入
 *
 * 帳號規則：純字串 username + @jingxin.local 字尾（login form 會自動處理）。
 * 例：老闆娘輸入 "ting201314"，DB 存 "ting201314@jingxin.local"。
 *
 * 帳密來源：C:\RenStudio\case\washinmachine\帳號密碼.txt（2026-05-24 老闆娘提供）
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim()]; })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const RESET = process.argv.includes("--reset");
const DRY_RUN = process.argv.includes("--dry-run");
const INTERNAL_DOMAIN = "jingxin.local";

// ─── 員工清單 ────────────────────────────────────────────────────────────────
// account：使用者輸入的純字串（背後存成 account@jingxin.local）
// name：UI 顯示名稱
const STAFF = [
  // 老闆娘（owner，全權限）
  { account: "ting201314", password: "ting751212", name: "老闆娘",  role: "owner" },
  // 5 位清洗師傅（A/C/D/E/F 是老闆娘舊系統的師傅代號，沿用方便辨識）
  { account: "201314",     password: "010507230", name: "A-陳昶志", role: "technician" },
  { account: "5785",       password: "011202210", name: "C-徐祥瑋", role: "technician" },
  { account: "5357",       password: "011302190", name: "D-羅允辰", role: "technician" },
  { account: "1227",       password: "011311280", name: "E-葉翰霖", role: "technician" },
  { account: "6398",       password: "011504010", name: "F-楊仕丞", role: "technician" },
];

const toEmail = (account) => `${account}@${INTERNAL_DOMAIN}`;

async function findUserByEmail(email) {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 200 });
  return data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function reset() {
  console.log("Reset mode: 刪除所有 @jingxin.local 帳號...\n");
  const { data } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const targets = (data?.users ?? []).filter(u =>
    u.email?.endsWith(`@${INTERNAL_DOMAIN}`)
  );
  for (const u of targets) {
    if (DRY_RUN) {
      console.log(`  [dry-run] would delete ${u.email}`);
      continue;
    }
    // 先刪 profile 才能刪 auth.user
    await supabase.from("user_profiles").delete().eq("id", u.id);
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) console.error(`  ✗ ${u.email}: ${error.message}`);
    else console.log(`  ✓ 已刪 ${u.email}`);
  }
  console.log(`Reset 完成：${targets.length} 個帳號\n`);
}

async function main() {
  console.log(`\n=== Seed Production Staff (${DRY_RUN ? "DRY-RUN" : "LIVE"}) ===\n`);
  if (RESET && !DRY_RUN) await reset();

  for (const s of STAFF) {
    const email = toEmail(s.account);
    const existing = await findUserByEmail(email);

    if (existing) {
      console.log(`= ${s.account.padEnd(12)} ${s.name.padEnd(10)} [已存在，略過]`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`+ ${s.account.padEnd(12)} ${s.name.padEnd(10)} [${s.role}] (dry-run)`);
      continue;
    }

    const { data: created, error: aErr } = await supabase.auth.admin.createUser({
      email,
      password: s.password,
      email_confirm: true,
      user_metadata: { name: s.name },
    });
    if (aErr || !created.user) {
      console.error(`✗ ${s.account}: ${aErr?.message}`);
      continue;
    }

    const { error: pErr } = await supabase.from("user_profiles").insert({
      id: created.user.id,
      name: s.name,
      role: s.role,
      active: true,
    });
    if (pErr) {
      console.error(`✗ profile ${s.account}: ${pErr.message}`);
      await supabase.auth.admin.deleteUser(created.user.id);
      continue;
    }

    console.log(`+ ${s.account.padEnd(12)} ${s.name.padEnd(10)} [${s.role}]`);
  }
  console.log("\n=== Done ===");
  console.log("登入方式：\n");
  for (const s of STAFF) {
    console.log(`  ${s.name.padEnd(10)} 帳號: ${s.account.padEnd(12)} 密碼: ${s.password}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
