/**
 * 帳號 ↔ email 轉換工具
 *
 * 背景：Supabase auth.users 強制 email 格式，但老闆娘/師傅習慣用純字串帳號
 * （例如「ting201314」「201314」）。我們做兩層映射：
 *
 *   使用者看到的「帳號」      ↔ DB 實際存的 email
 *   ─────────────────────────────────────────────
 *   ting201314             ↔ ting201314@jingxin.local
 *   201314                 ↔ 201314@jingxin.local
 *   ren.studio.dev@gmail.com ↔ ren.studio.dev@gmail.com  (含 @ → 原文不動)
 *
 * 規則：輸入字串含「@」就視為真實 email，原文不動；否則自動補 INTERNAL_DOMAIN。
 *
 * 這個字尾不對外發信、不必真實存在，純粹過 supabase auth 的格式檢查。
 */

export const INTERNAL_DOMAIN = "jingxin.local";

/** 使用者輸入「帳號」 → 給 supabase auth 用的 email */
export function usernameToEmail(input: string): string {
  const s = input.trim();
  if (!s) return s;
  return s.includes("@") ? s : `${s}@${INTERNAL_DOMAIN}`;
}

/** DB 存的 email → 給 UI 顯示的「帳號」 */
export function emailToUsername(email: string | null | undefined): string {
  if (!email) return "";
  return email.endsWith(`@${INTERNAL_DOMAIN}`)
    ? email.slice(0, -1 * (INTERNAL_DOMAIN.length + 1))
    : email;
}
