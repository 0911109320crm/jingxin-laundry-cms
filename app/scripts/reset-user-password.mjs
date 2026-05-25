#!/usr/bin/env node
/**
 * 緊急重設使用者密碼（給 RC 用，當老闆娘 / 師傅完全登不進來時）
 *
 * 用法:
 *   node scripts/reset-user-password.mjs <帳號> <新密碼>
 *
 * 範例:
 *   node scripts/reset-user-password.mjs ting201314 newpass123
 *   node scripts/reset-user-password.mjs 5785 abc12345
 *
 * 規則：
 *   - 帳號可以打純字串（會自動補 @jingxin.local）或完整 email
 *   - 密碼最少 6 字
 */
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

const [account, newPassword] = process.argv.slice(2);
if (!account || !newPassword) {
  console.error("用法: node scripts/reset-user-password.mjs <帳號> <新密碼>");
  console.error("範例: node scripts/reset-user-password.mjs ting201314 newpass123");
  process.exit(1);
}
if (newPassword.length < 6) {
  console.error("密碼至少 6 字");
  process.exit(1);
}

const INTERNAL_DOMAIN = "jingxin.local";
const email = account.includes("@") ? account : `${account}@${INTERNAL_DOMAIN}`;

const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const { data } = await s.auth.admin.listUsers({ perPage: 200 });
const user = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`✗ 找不到帳號 ${account} (email: ${email})`);
  process.exit(1);
}

const { error } = await s.auth.admin.updateUserById(user.id, { password: newPassword });
if (error) {
  console.error(`✗ 重設失敗: ${error.message}`);
  process.exit(1);
}

console.log(`✓ 已重設 ${account} (${email}) 的密碼為: ${newPassword}`);
console.log(`  請告知該使用者新密碼並提醒登入後盡快自行修改。`);
