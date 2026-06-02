import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { AgendaCalendar, type AgendaNote } from "./AgendaCalendar";

export default async function AgendaPage() {
  const me = await requireRole(["owner", "manager"]);
  const supabase = await createClient();

  // 載入個人筆記（前 2 個月 ~ 後 6 個月）；RLS 限定只回自己的
  const winStart = new Date();
  winStart.setMonth(winStart.getMonth() - 2);
  const winEnd = new Date();
  winEnd.setMonth(winEnd.getMonth() + 6);

  const { data } = await supabase
    .from("calendar_notes")
    .select("note_date, content")
    .eq("user_id", me.id)
    .gte("note_date", winStart.toISOString().slice(0, 10))
    .lte("note_date", winEnd.toISOString().slice(0, 10));

  const notes: AgendaNote[] = (
    (data as { note_date: string; content: string }[] | null) ?? []
  ).map((n) => ({ date: n.note_date, content: n.content }));

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">我的行事曆</h1>
        <p className="text-sm text-zinc-500">
          點任一天即可記下當天雜事（汽車保養、保險繳費…）。只有你自己看得到。
        </p>
      </header>
      <AgendaCalendar notes={notes} />
    </div>
  );
}
