"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentUser } from "@/lib/dal";

export type Res = { ok: true } | { ok: false; error: string };

export async function markReminderSent(id: string): Promise<Res> {
  const me = await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("reminders")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_by: me.id,
      channel: "line",
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markReminderSkipped(id: string): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("reminders")
    .update({ status: "skipped" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function refreshReminders(): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("refresh_annual_reminders");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reminders");
  return { ok: true };
}
