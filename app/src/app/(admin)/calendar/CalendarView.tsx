"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput } from "@fullcalendar/core";
import {
  rescheduleOrderAction,
  quickScheduleAction,
  cancelOrderAction,
} from "@/app/(admin)/orders/actions";

const TECH_COLORS = [
  "#4f46e5",
  "#0891b2",
  "#16a34a",
  "#ea580c",
  "#db2777",
  "#9333ea",
  "#0d9488",
  "#dc2626",
];
const UNASSIGNED_COLOR = "#6b7280";

export type CalendarOrder = {
  id: string;
  order_code: string;
  scheduled_at: string;
  scheduled_end_at: string | null;
  status: "pending" | "scheduled" | "in_progress" | "done" | "cancelled";
  total: number;
  customer_name: string;
  customer_phone: string | null;
  district: string | null;
  full_address: string | null;
  service_summary: string;
  technician_id: string | null;
  technician_name: string | null;
};

function colorFor(techId: string | null, techList: string[]) {
  if (!techId) return UNASSIGNED_COLOR;
  const idx = techList.indexOf(techId);
  return TECH_COLORS[idx % TECH_COLORS.length];
}

function defaultEnd(startIso: string) {
  const d = new Date(startIso);
  d.setMinutes(d.getMinutes() + 90);
  return d.toISOString();
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function CalendarView({
  orders,
  technicianIds,
  techFilter,
}: {
  orders: CalendarOrder[];
  technicianIds: string[];
  techFilter: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const events: EventInput[] = orders.map((o) => {
    const end = o.scheduled_end_at ?? defaultEnd(o.scheduled_at);
    const startT = timeLabel(o.scheduled_at);
    const endT = timeLabel(end);
    const tooltipLines = [
      `${o.order_code}  ${startT}–${endT}`,
      `客戶：${o.customer_name}${o.customer_phone ? ` · ${o.customer_phone}` : ""}`,
      o.full_address ? `地址：${o.full_address}` : null,
      o.technician_name ? `師傅：${o.technician_name}` : null,
      o.service_summary ? `服務：${o.service_summary}` : null,
      `應收：NT$ ${o.total.toLocaleString()}`,
    ].filter(Boolean);
    return {
      id: o.id,
      start: o.scheduled_at,
      end,
      backgroundColor: colorFor(o.technician_id, technicianIds),
      borderColor: colorFor(o.technician_id, technicianIds),
      extendedProps: {
        order_code: o.order_code,
        total: o.total,
        status: o.status,
        customer: o.customer_name,
        district: o.district,
        technician_name: o.technician_name,
        start_time: startT,
        end_time: endT,
        tooltip: tooltipLines.join("\n"),
      },
    };
  });

  // Pre-aggregate daily totals (for day-cell badge)
  const dailyTotals = new Map<string, number>();
  for (const o of orders) {
    const date = o.scheduled_at.slice(0, 10);
    dailyTotals.set(date, (dailyTotals.get(date) ?? 0) + Number(o.total));
  }

  return (
    <div className="calendar-wrapper">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="zh-tw"
        height="auto"
        firstDay={1}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,dayGridWeek",
        }}
        buttonText={{ today: "本月", month: "月", week: "週" }}
        dayCellDidMount={(info) => {
          const dateKey = info.date.toISOString().slice(0, 10);
          const sum = dailyTotals.get(dateKey);
          if (!sum) return;
          const top = info.el.querySelector(".fc-daygrid-day-top");
          if (!top) return;
          // Avoid duplicate insertion on re-mount
          if (top.querySelector(".day-total-badge")) return;
          const badge = document.createElement("span");
          badge.className =
            "day-total-badge ml-auto rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-600";
          badge.textContent = `$${sum.toLocaleString()}`;
          top.appendChild(badge);
        }}
        events={events}
        editable
        droppable
        eventDisplay="block"
        displayEventTime={false}
        eventDidMount={(info) => {
          const tip = info.event.extendedProps.tooltip as string | undefined;
          if (tip) info.el.setAttribute("title", tip);
        }}
        eventClick={(info) =>
          router.push(`/orders/${info.event.id}?from=calendar`)
        }
        dateClick={(info) =>
          router.push(`/orders/new?date=${info.dateStr}T09:00&from=calendar`)
        }
        eventDrop={(info) => {
          const newStart = info.event.start?.toISOString();
          const newEnd = info.event.end?.toISOString();
          if (!newStart) {
            info.revert();
            return;
          }
          startTransition(async () => {
            const res = await rescheduleOrderAction(
              info.event.id,
              newStart,
              newEnd,
            );
            if (!res.ok) {
              alert(`移動失敗：${res.error}`);
              info.revert();
            } else {
              router.refresh();
            }
          });
        }}
        eventReceive={(info) => {
          const orderId = info.event.extendedProps.orderId as
            | string
            | undefined;
          if (!orderId) {
            info.event.remove();
            return;
          }
          const start = info.event.start
            ? new Date(info.event.start)
            : null;
          if (!start) {
            info.event.remove();
            return;
          }
          if (info.event.allDay) {
            start.setHours(9, 0, 0, 0);
          }
          const end = new Date(start);
          end.setMinutes(end.getMinutes() + 90);
          info.event.remove();
          startTransition(async () => {
            const res = await quickScheduleAction({
              orderId,
              startIso: start.toISOString(),
              endIso: end.toISOString(),
              technicianId: techFilter === "all" ? null : techFilter,
            });
            if (!res.ok) {
              alert(`派工失敗：${res.error}`);
            } else {
              router.refresh();
            }
          });
        }}
        eventContent={(arg) => {
          const start = arg.event.extendedProps.start_time as string;
          const end = arg.event.extendedProps.end_time as string;
          const customer = arg.event.extendedProps.customer as string;
          const district = arg.event.extendedProps.district as string | null;
          const onCancel = (e: React.MouseEvent) => {
            e.stopPropagation();
            const reason = window.prompt(
              `取消「${customer}」的這筆訂單，請輸入原因：\n（例：客戶臨時有事 / 客戶不在家 / 機器自行處理）`,
            );
            if (!reason || !reason.trim()) return;
            startTransition(async () => {
              const res = await cancelOrderAction(arg.event.id, reason);
              if (!res.ok) alert(`取消失敗：${res.error}`);
              else router.refresh();
            });
          };
          return (
            <div className="group relative overflow-hidden px-1 text-xs leading-tight space-y-0.5">
              <button
                type="button"
                onClick={onCancel}
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute right-0.5 top-0.5 z-10 hidden h-4 w-4 items-center justify-center rounded bg-black/40 text-[10px] font-bold leading-none text-white hover:bg-red-600 group-hover:flex"
                title="快速取消此訂單"
              >
                ×
              </button>
              <div className="font-semibold tracking-tight">
                {start}–{end}
              </div>
              <div className="truncate">
                {customer}
                {district ? ` · ${district}` : ""}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
