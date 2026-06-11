"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/auth-username";

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const account = String(formData.get("account") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!account || !password) {
    return { error: "請輸入帳號與密碼" };
  }

  // 純字串帳號（例「ting201314」）→ 補 @jingxin.local；含 @ 就保留原文
  const email = usernameToEmail(account);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "登入失敗：帳號或密碼錯誤" };
  }

  // 僅允許站內相對路徑；擋掉 //evil.com、/\evil.com 這類 protocol-relative 開放重導
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
      ? next
      : "/";
  redirect(safeNext);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
