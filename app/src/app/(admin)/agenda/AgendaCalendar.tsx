"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput } from "@fullcalendar/core";
import { X } from "lucide-react";
import { upsertCalendarNoteAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

export type AgendaNote = { date: string; content: string };

export function AgendaCalendar({ notes }: { notes: AgendaNote[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const noteByDate = new Map(notes.map((n) => [n.date, n.content]));

  const [editDate, setEditDate] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // 開啟時這天本來有沒有內容（決定要不要顯示「刪除」鈕）
  const [hadNote, setHadNote] = useState(false);

  const openDay = (date: string) => {
    const existing = noteByDate.get(date) ?? "";
    setEditDate(date);
    setDraft(existing);
    setHadNote(existing.trim().length > 0);
  };

  const save = () => {
    if (!editDate) return;
    const date = editDate;
    startTransition(async () => {
      const res = await upsertCalendarNoteAction(date, draft);
      if (!res.ok) {
        alert(res.error ?? "儲存失敗");
        return;
      }
      setEditDate(null);
      router.refresh();
    });
  };

  const removeNote = () => {
    if (!editDate) return;
    if (!confirm("確定刪除這天的行程？")) return;
    const date = editDate;
    startTransition(async () => {
      const res = await upsertCalendarNoteAction(date, "");
      if (!res.ok) {
        alert(res.error ?? "刪除失敗");
        return;
      }
      setEditDate(null);
      router.refresh();
    });
  };

  const events: EventInput[] = notes.map((n) => ({
    id: `note-${n.date}`,
    start: n.date,
    allDay: true,
    display: "block",
    backgroundColor: "#f59e0b",
    borderColor: "#f59e0b",
    extendedProps: { content: n.content },
  }));

  return (
    <div className="calendar-wrapper">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="zh-tw"
        height="auto"
        firstDay={1}
        headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        buttonText={{ today: "本月" }}
        events={events}
        eventDisplay="block"
        displayEventTime={false}
        dateClick={(info) => openDay(info.dateStr)}
        eventClick={(info) => {
          const d = info.event.startStr.slice(0, 10);
          openDay(d);
        }}
        eventContent={(arg) => {
          const content = arg.event.extendedProps.content as string;
          return (
            <div className="whitespace-pre-wrap break-words px-1 py-0.5 text-xs leading-tight text-white">
              {content}
            </div>
          );
        }}
      />

      {editDate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => !pending && setEditDate(null)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 className="text-base font-bold text-zinc-900">{editDate} 行程</h2>
              <button
                type="button"
                onClick={() => setEditDate(null)}
                disabled={pending}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 py-4">
              <Textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="這天的雜事，例如：汽車保養、保險繳費、繳水電…（多件事換行寫）"
              />
              <p className="mt-1 text-right text-xs text-zinc-400">
                {draft.length} / 2000
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3">
              <div>
                {hadNote && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={removeNote}
                    className="text-rose-600 hover:bg-rose-50"
                  >
                    刪除
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setEditDate(null)}
                >
                  取消
                </Button>
                <Button type="button" disabled={pending} onClick={save}>
                  {pending ? "儲存中…" : "儲存"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
