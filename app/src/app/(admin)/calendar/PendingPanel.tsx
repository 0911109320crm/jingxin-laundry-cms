"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Draggable } from "@fullcalendar/interaction";
import { MapPin, ClipboardList, GripVertical, Clock } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { PhoneList, type PhoneItem } from "@/components/customers/PhoneList";
import { formatTaipeiTime, formatTaipeiMonthDay } from "@/lib/timezone";

export type PendingOrder = {
  id: string;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  customer_phones?: PhoneItem[];
  address: string;
  service_summary: string;
  total: number;
  has_technician: boolean;
  scheduled_at: string | null;
  scheduled_end_at: string | null;
  duration_minutes: number;
};

/**
 * 拖曳期間高亮 FullCalendar 的目標日期格。
 * FC v6 外部拖入時只顯示淡淡的 mirror、不會高亮整格，老闆娘反應看不出落在哪天；
 * 這裡用 pointer + elementFromPoint 自行標示，不依賴 FC 內部 API。
 */
function startDropHighlight() {
  let lastCell: Element | null = null;
  const clear = () => {
    if (lastCell) {
      lastCell.classList.remove("fc-drop-target");
      lastCell = null;
    }
  };
  const move = (e: PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el?.closest(".fc-daygrid-day") ?? null;
    if (cell === lastCell) return;
    clear();
    if (cell) {
      cell.classList.add("fc-drop-target");
      lastCell = cell;
    }
  };
  const stop = () => {
    clear();
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", stop);
    document.removeEventListener("pointercancel", stop);
  };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", stop);
  document.addEventListener("pointercancel", stop);
}

// 一律用台灣時區格式化。此元件雖是 client component，Next.js App Router 仍會先
// SSR 一次；在 Vercel(UTC) 上用 getHours() 會把 11:00 顯示成 03:00，且 hydration
// 後無 state 變更不會 re-render、錯誤值會留著。改用鎖定 Asia/Taipei 的 formatter。
function formatTimeSlot(startIso: string | null, endIso: string | null): string | null {
  if (!startIso) return null;
  const startTime = formatTaipeiTime(startIso);
  if (!startTime) return null;
  const dateLabel = formatTaipeiMonthDay(startIso);
  if (!endIso) return `${dateLabel} ${startTime}`;
  const endTime = formatTaipeiTime(endIso);
  if (!endTime) return `${dateLabel} ${startTime}`;
  return `${dateLabel} ${startTime}–${endTime}`;
}

export function PendingPanel({ orders }: { orders: PendingOrder[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const draggable = new Draggable(containerRef.current, {
      itemSelector: ".pending-draggable",
      eventData: (el) => {
        const orderId = el.getAttribute("data-order-id") ?? "";
        const title = el.getAttribute("data-title") ?? "訂單";
        const origStart = el.getAttribute("data-orig-start") || null;
        const origEnd = el.getAttribute("data-orig-end") || null;
        const durationStr = el.getAttribute("data-duration-min") || "90";
        const dm = Math.max(15, parseInt(durationStr, 10) || 90);
        const hh = String(Math.floor(dm / 60)).padStart(2, "0");
        const mm = String(dm % 60).padStart(2, "0");
        return {
          title,
          duration: `${hh}:${mm}`,
          create: true,
          extendedProps: {
            orderId,
            fromPending: true,
            origStart,
            origEnd,
            durationMinutes: dm,
          },
        };
      },
    });
    return () => draggable.destroy();
  }, [orders.map((o) => o.id).join(",")]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-amber-500" />
          待派工 ({orders.length})
        </CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {orders.length === 0 ? (
          <p className="p-5 text-sm text-zinc-500">沒有待派工案件</p>
        ) : (
          <>
            <p className="px-4 pt-2 pb-1 text-xs text-zinc-400">
              拖拉卡片到月曆排定日期
            </p>
            <div
              ref={containerRef}
              className="max-h-[600px] overflow-y-auto divide-y divide-zinc-200"
            >
              {orders.map((o) => {
                const slot = formatTimeSlot(o.scheduled_at, o.scheduled_end_at);
                return (
                  <div
                    key={o.id}
                    className="pending-draggable group relative flex select-none transition-colors hover:bg-amber-50"
                    data-order-id={o.id}
                    data-title={o.customer_name}
                    data-orig-start={o.scheduled_at ?? ""}
                    data-orig-end={o.scheduled_end_at ?? ""}
                    data-duration-min={String(o.duration_minutes)}
                  >
                    {/* 拖曳把手：手機 touch 要按住這條才能拖（touch-none 讓手勢交給
                        FullCalendar，卡片其餘區域維持可捲動清單）。桌機滑鼠整卡都能拖。 */}
                    <div
                      className="drag-handle flex w-10 shrink-0 cursor-grab touch-none flex-col items-center justify-center gap-1 border-r border-amber-100 bg-amber-50 text-amber-500 active:cursor-grabbing"
                      onPointerDown={startDropHighlight}
                      title="按住這裡拖到月曆排定"
                    >
                      <GripVertical className="h-5 w-5" />
                      <span className="text-[10px] font-medium leading-none">拖</span>
                    </div>
                    <div className="min-w-0 flex-1 px-4 py-3">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-mono">{o.order_code}</span>
                      {!o.has_technician && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                          未指派
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {slot ? (
                        <p className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
                          <Clock className="h-3 w-3" />
                          預約時段 {slot}
                        </p>
                      ) : (
                        <p className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                          <Clock className="h-3 w-3" />
                          未指定時段
                        </p>
                      )}
                      <p className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                        預計 {o.duration_minutes} 分
                      </p>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-zinc-900">
                      {o.customer_name}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      <PhoneList
                        primary={o.customer_phone}
                        phones={o.customer_phones}
                        mode="inline"
                      />
                    </p>
                    <p className="mt-0.5 flex items-start gap-1 text-xs text-zinc-600">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="leading-tight">{o.address}</span>
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{o.service_summary}</p>
                    <div className="mt-1.5 flex items-center justify-end">
                      <Link
                        href={`/orders/${o.id}/edit?from=calendar`}
                        className="text-xs text-zinc-500 hover:text-brand-700 hover:underline"
                        draggable={false}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        編輯詳情 →
                      </Link>
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
