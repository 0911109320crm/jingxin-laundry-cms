"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { usernameToEmail } from "@/lib/auth-username";

const CreateUserSchema = z.object({
  // 帳號可填純字串（會自動補 @jingxin.local）或完整 email
  account: z
    .string()
    .min(1, "請填帳號")
    .max(60)
    .regex(/^[A-Za-z0-9._+\-@]+$/, "帳號只能用英數、 . _ + - @"),
  password: z.string().min(6, "密碼至少 6 字"),
  name: z.string().min(1, "請填姓名").max(40),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(["owner", "manager", "technician"]),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(40),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(["owner", "manager", "technician"]),
  active: z.coerce.boolean(),
});

export type Res = { ok: true } | { ok: false; error: string };

export async function createUser(fd: FormData): Promise<Res> {
  await requireRole(["owner"]);
  // 表單欄位先試 "account" 再 fallback "email"（向後相容）
  const accountRaw = String(fd.get("account") ?? fd.get("email") ?? "").trim();
  const parsed = CreateUserSchema.safeParse({
    account: accountRaw,
    // 密碼必填，不再 fallback 成共用預設值（避免把弱密碼帶進正式帳號）
    password: fd.get("password") ?? "",
    name: fd.get("name"),
    phone: fd.get("phone") || null,
    role: fd.get("role"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { account, password, name, phone, role } = parsed.data;
  const email = usernameToEmail(account);

  const admin = createAdminClient();
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (authErr || !created.user) {
    return { ok: false, error: authErr?.message ?? "建立 Auth 帳號失敗" };
  }

  const { error: profileErr } = await admin.from("user_profiles").insert({
    id: created.user.id,
    name,
    phone,
    role,
    active: true,
  });
  if (profileErr) {
    // Rollback: delete the orphaned auth user
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: `Profile 寫入失敗：${profileErr.message}` };
  }

  await logAudit({
    action: "user.create",
    target_type: "user",
    target_id: created.user.id,
    payload: { account, email, name, role },
  });

  revalidatePath("/settings/users");
  return { ok: true };
}

export async function updateUser(id: string, fd: FormData): Promise<Res> {
  await requireRole(["owner"]);
  const parsed = UpdateUserSchema.safeParse({
    name: fd.get("name"),
    phone: fd.get("phone") || null,
    role: fd.get("role"),
    active: fd.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  // 新密碼：留空 = 不改；有填則必須 ≥6 字（讓老闆娘在「編輯」就能直接改密碼）
  const newPassword = String(fd.get("password") ?? "").trim();
  if (newPassword && newPassword.length < 6) {
    return { ok: false, error: "新密碼至少 6 字（不改請留空）" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (newPassword) {
    const { error: pwErr } = await admin.auth.admin.updateUserById(id, {
      password: newPassword,
    });
    if (pwErr) return { ok: false, error: `密碼更新失敗：${pwErr.message}` };
  }

  await logAudit({
    action: "user.update",
    target_type: "user",
    target_id: id,
    payload: { ...parsed.data, password_changed: !!newPassword },
  });

  revalidatePath("/settings/users");
  return { ok: true };
}

export async function resetPassword(id: string, fd: FormData): Promise<Res> {
  await requireRole(["owner"]);
  const password = String(fd.get("password") ?? "").trim();
  if (password.length < 6) return { ok: false, error: "密碼至少 6 字" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { ok: false, error: error.message };
  await logAudit({
    action: "user.reset_password",
    target_type: "user",
    target_id: id,
  });
  return { ok: true };
}

export async function deleteUser(id: string): Promise<Res> {
  const me = await requireRole(["owner"]);
  if (me.id === id) {
    return { ok: false, error: "不能刪除自己" };
  }

  const admin = createAdminClient();
  // Delete profile first (FK cascade will remove from auth.users when we call admin)
  const { error: pErr } = await admin
    .from("user_profiles")
    .delete()
    .eq("id", id);
  if (pErr) return { ok: false, error: pErr.message };

  const { error: aErr } = await admin.auth.admin.deleteUser(id);
  if (aErr) return { ok: false, error: aErr.message };

  await logAudit({ action: "user.delete", target_type: "user", target_id: id });

  revalidatePath("/settings/users");
  return { ok: true };
}
