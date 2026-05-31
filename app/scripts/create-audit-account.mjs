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

const EMAIL = "audit@jingxin.local";   // 帳號顯示為 audit
const PASSWORD = process.env.AUDIT_PW;  // 由命令列帶入，不寫死
const FLOOR = "2022-08-11";
const NAME = "查帳唯讀帳號";

if (!PASSWORD) { console.error("缺少 AUDIT_PW"); process.exit(1); }

// 1) 建 auth user（若已存在則找出來更新）
let userId;
const { data: created, error: cErr } = await s.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  app_metadata: { readonly: true, audit: true },
  user_metadata: { name: NAME },
});
if (cErr) {
  // 可能已存在 → 找到並更新密碼 + app_metadata
  const { data: list } = await s.auth.admin.listUsers({ perPage: 1000 });
  const found = list?.users?.find((u) => u.email === EMAIL);
  if (!found) { console.error("建立失敗且找不到既有帳號：" + cErr.message); process.exit(1); }
  userId = found.id;
  await s.auth.admin.updateUserById(userId, {
    password: PASSWORD,
    app_metadata: { readonly: true, audit: true },
  });
  console.log("帳號已存在 → 已更新密碼/標記");
} else {
  userId = created.user.id;
  console.log("已建立 auth 帳號");
}

// 2) user_profiles（upsert）：role=manager、readonly、floor
const { error: pErr } = await s.from("user_profiles").upsert({
  id: userId,
  name: NAME,
  role: "manager",
  active: true,
  readonly: true,
  data_floor_date: FLOOR,
}, { onConflict: "id" });
if (pErr) { console.error("profile 寫入失敗：" + pErr.message); process.exit(1); }

console.log(`OK 查帳帳號就緒：帳號=audit  email=${EMAIL}  floor=${FLOOR}  readonly=true  uid=${userId}`);
