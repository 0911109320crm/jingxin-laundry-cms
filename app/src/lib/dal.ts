import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile, UserRole } from "@/types/database";

export type AuthedUser = {
  id: string;
  email: string | null;
  profile: UserProfile;
};

/**
 * Get the currently authenticated user with their profile.
 * Cached per request via React.cache to avoid duplicate Supabase calls.
 */
export const getCurrentUser = cache(async (): Promise<AuthedUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, name, phone, role, active, readonly, data_floor_date, can_view_all")
    .eq("id", user.id)
    .single();

  const p = profile as UserProfile | null;
  if (!p || !p.active) return null;

  return { id: user.id, email: user.email ?? null, profile: p };
});

export async function requireAuth(): Promise<AuthedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(roles: UserRole[]): Promise<AuthedUser> {
  const user = await requireAuth();
  if (!roles.includes(user.profile.role)) redirect("/unauthorized");
  return user;
}

/**
 * 寫入型 server action 專用：requireRole + 擋 readonly 帳號（查帳用唯讀 manager）。
 * 很多寫入 action 用 admin client 繞 RLS，唯讀只擋頁面 UI 不夠，
 * readonly 帳號直接對 action 發 POST 仍可寫入。頁面載入(讀)請繼續用 requireRole。
 */
export async function requireWriteRole(roles: UserRole[]): Promise<AuthedUser> {
  const user = await requireRole(roles);
  if (user.profile.readonly) redirect("/unauthorized");
  return user;
}
