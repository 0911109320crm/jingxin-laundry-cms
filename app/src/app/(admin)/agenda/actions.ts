"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

type Res = { ok: boolean; error?: string };

/**
 * 新增/更新某天的個人行事曆筆記（一人一天一筆，多行文字）。
 * content 留空＝刪除該天筆記。RLS 限定只能存取自己的(user_id = auth.uid())。
 */
export async function upsertCalendarNoteAction(
  noteDate: string,
  content: string,
): Promise<Res> {
  const me = await requireRole(["owner", "manager"]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) {
    return { ok: false, error: "日期格式錯誤" };
  }
  const supabase = await createClient();
  const trimmed = content.trim();

  if (!trimmed) {
    const { error } = await supabase
      .from("calendar_notes")
      .delete()
      .eq("user_id", me.id)
      .eq("note_date", noteDate);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/agenda");
    return { ok: true };
  }

  const { error } = await supabase.from("calendar_notes").upsert(
    {
      user_id: me.id,
      note_date: noteDate,
      content: trimmed.slice(0, 2000),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,note_date" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/agenda");
  return { ok: true };
}
