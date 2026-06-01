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

const NEW_EMAIL = "admin@jingxin.local"; // 帳號顯示為 admin
const NEW_PW = process.env.NEW_PW;
if (!NEW_PW) { console.error("缺少 NEW_PW"); process.exit(1); }

// 找現有查帳帳號（audit@jingxin.local 或 admin@jingxin.local）
const { data: list } = await s.auth.admin.listUsers({ perPage: 1000 });
const u = list?.users?.find((x) => x.email === "audit@jingxin.local" || x.email === NEW_EMAIL);
if (!u) { console.error("找不到查帳帳號"); process.exit(1); }

const { error } = await s.auth.admin.updateUserById(u.id, {
  email: NEW_EMAIL,
  password: NEW_PW,
  email_confirm: true,
  app_metadata: { readonly: true, audit: true },
});
if (error) { console.error("FAIL " + error.message); process.exit(1); }
console.log(`OK 帳號=admin email=${NEW_EMAIL} 密碼已設 uid=${u.id}`);
