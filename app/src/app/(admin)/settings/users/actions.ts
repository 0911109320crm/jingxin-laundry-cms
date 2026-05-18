"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";

const CreateUserSchema = z.object({
  email: z.string().email("Email 格式錯誤"),
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
  const parsed = CreateUserSchema.safeParse({
    email: fd.get("email"),
    password: fd.get("password") || "admin1234",
    name: fd.get("name"),
    phone: fd.get("phone") || null,
    role: fd.get("role"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { email, password, name, phone, role } = parsed.data;

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

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

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

  revalidatePath("/settings/users");
  return { ok: true };
}
