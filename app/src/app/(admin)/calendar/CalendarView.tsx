"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput } from "@fullcalendar/core";
import {
  rescheduleOrderAction,
  quickScheduleAction,
  cancelOrderAction,
  unscheduleOrderAction,
} from "@/app/(admin)/orders/actions";
import { techHex } from "@/lib/tech-colors";

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

export type CalendarLeave = {
  id: string;
  date: string; // YYYY-MM-DD
  period: "full" | "am" | "pm";
  technician_id: string;
  technician_name: string;
};

export type CalendarOrder = {
  id: string;
  order_code: string;
  scheduled_at: string;
  scheduled_end_at: string | null;
  status: "pending" | "scheduled" | "in_progress" | "done" | "cancelled";
  total: number;
  customer_name: string;
  customer_phone: string | null;
  area: string | null;
  full_address: string | null;
  service_summary: string;
  technician_id: string | null;
  technician_name: string | null;
};

function colorFor(
  techId: string | null,
  techList: string[],
  techName?: string | null,
) {
  // 先用老闆娘指定的師傅代表色（依姓名），找不到才退回索引調色盤
  const named = techHex(techName);
  if (named) return named;
  if (!techId) return UNASSIGNED_COLOR;
  const idx = techList.indexOf(techId);
  return TECH_COLORS[idx % TECH_COLORS.length];
}

function defaultEnd(startIso: string) {
  const d = new Date(startIso);
  d.setMinutes(d.getMinutes() + 90);
  return d.toISOString();
}

// 一律以台灣時區格式化，避免依賴執行環境時區。
// 主月曆在 Vercel SSR(UTC) 算 getHours() 會把 09:00 顯示成 01:00、14:00 變 06:00；
// 月檢視早已用 Asia/Taipei 寫死所以是對的，這裡比照修正。
const TW_TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Taipei",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function timeLabel(iso: string) {
  const t = TW_TIME_FMT.format(new Date(iso));
  return t.startsWith("24") ? `00${t.slice(2)}` : t;
}

/**
 * 避免時段衝突：若 desiredStart 跟同一天同師傅的既有訂單重疊，
 * 把開始時間往後挪到下一個空檔，直到無重疊或超過當天 22:00。
 *
 * @returns shifted=true 表示有挪動過、failed=true 表示挪不下（整天滿）
 */
function findFreeSlot(
  desiredStart: Date,
  durationMinutes: number,
  existingOrders: CalendarOrder[],
  technicianId: string | null,
  excludeOrderId?: string,
): { start: Date; shifted: boolean; failed: boolean } {
  const sameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  // 找出同日同師傅的既有訂單時段
  const ranges = existingOrders
    .filter((o) => {
      if (excludeOrderId && o.id === excludeOrderId) return false;
      const s = new Date(o.scheduled_at);
      if (!sameDate(s, desiredStart)) return false;
      // 月曆當下只看當前 tech tab 的訂單；同師傅才會衝突
      if (technicianId && o.technician_id !== technicianId) return false;
      return true;
    })
    .map((o) => {
      const s = new Date(o.scheduled_at).getTime();
      const e = o.scheduled_end_at
        ? new Date(o.scheduled_end_at).getTime()
        : s + 90 * 60_000;
      return { start: s, end: e };
    })
    .sort((a, b) => a.start - b.start);

  const cutoff = new Date(desiredStart);
  cutoff.setHours(22, 0, 0, 0);
  const cutoffMs = cutoff.getTime();

  let startMs = desiredStart.getTime();
  const initialMs = startMs;
  let changed = true;
  let guard = 0;
  while (changed && guard < 50) {
    changed = false;
    guard++;
    for (const r of ranges) {
      const endMs = startMs + durationMinutes * 60_000;
      if (endMs <= r.start) break; // 在這個之前，安全
      if (startMs >= r.end) continue; // 在這個之後，繼續比下一個
      // 重疊 → 挪到 r.end
      startMs = r.end;
      changed = true;
      if (startMs + durationMinutes * 60_000 > cutoffMs) {
        return { start: desiredStart, shifted: false, failed: true };
      }
      break;
    }
  }

  return {
    start: new Date(startMs),
    shifted: startMs !== initialMs,
    failed: false,
  };
}

type ActionTarget = { id: string; customer: string };

const LEAVE_PERIOD_LABEL: Record<CalendarLeave["period"], string> = {
  full: "全日休",
  am: "上午休",
  pm: "下午休",
};

export function CalendarView({
  orders,
  leaves = [],
  technicianIds,
  techFilter,
}: {
  orders: CalendarOrder[];
  leaves?: CalendarLeave[];
  technicianIds: string[];
  techFilter: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");

  const closeAll = () => {
    setActionTarget(null);
    setReasonOpen(false);
    setReason("");
  };

  const handleUnschedule = () => {
    if (!actionTarget) return;
    const target = actionTarget;
    startTransition(async () => {
      const res = await unscheduleOrderAction(target.id);
      if (!res.ok) alert(`回到待派工失敗：${res.error}`);
      else router.refresh();
      closeAll();
    });
  };

  const handleSubmitCancel = () => {
    if (!actionTarget) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      alert("請填取消原因");
      return;
    }
    const target = actionTarget;
    startTransition(async () => {
      const res = await cancelOrderAction(target.id, trimmed);
      if (!res.ok) alert(`取消失敗：${res.error}`);
      else router.refresh();
      closeAll();
    });
  };

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
      backgroundColor: colorFor(o.technician_id, technicianIds, o.technician_name),
      borderColor: colorFor(o.technician_id, technicianIds, o.technician_name),
      extendedProps: {
        order_code: o.order_code,
        total: o.total,
        status: o.status,
        customer: o.customer_name,
        area: o.area,
        technician_name: o.technician_name,
        service_summary: o.service_summary || null,
        start_time: startT,
        end_time: endT,
        tooltip: tooltipLines.join("\n"),
      },
    };
  });

  // 休假：以「全日事件」呈現在格子頂端，跟訂單(block)區隔，避免被誤認為「尚未排案」。
  const leaveEvents: EventInput[] = leaves.map((lv) => {
    const hex = techHex(lv.technician_name) ?? UNASSIGNED_COLOR;
    return {
      id: `leave-${lv.id}`,
      start: lv.date,
      allDay: true,
      display: "block",
      editable: false,
      startEditable: false,
      durationEditable: false,
      backgroundColor: hex,
      // 休假卡與排案卡同為師傅代表色，加紅色粗框 + class 才能一眼區別「這是休假不是排案」
      borderColor: "#e11d48",
      classNames: ["fc-leave-event"],
      extendedProps: {
        isLeave: true,
        techId: lv.technician_id,
        techName: lv.technician_name,
        periodLabel: LEAVE_PERIOD_LABEL[lv.period],
      },
    };
  });
  const allEvents = [...leaveEvents, ...events];

  // Pre-aggregate daily totals (for day-cell badge)
  // 用台灣時區計算「該訂單屬於哪一天」，避免 UTC slice 在跨日邊界誤判
  const TW_TZ_FMT = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Taipei",
  });
  const taiwanDateKey = (iso: string | Date) =>
    TW_TZ_FMT.format(typeof iso === "string" ? new Date(iso) : iso);

  const dailyTotals = new Map<string, number>();
  for (const o of orders) {
    const date = taiwanDateKey(o.scheduled_at);
    dailyTotals.set(date, (dailyTotals.get(date) ?? 0) + Number(o.total));
  }

  // FullCalendar 是包過的 vanilla JS 庫，events prop 改變時不一定會自動重畫。
  // 用 key 強制在 events 內容改變時 remount 整個 FullCalendar。
  // 缺點是會 reset 到 initialView，但拖曳後使用者本來就期待看到結果，可接受。
  const eventsKey =
    orders
      .map((o) => `${o.id}-${o.scheduled_at}-${o.scheduled_end_at}-${o.technician_id}-${o.status}`)
      .join("|") +
    "#" +
    leaves.map((lv) => `${lv.id}-${lv.date}-${lv.period}`).join("|");

  return (
    <div className="calendar-wrapper">
      <FullCalendar
        key={eventsKey}
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
          const dateKey = taiwanDateKey(info.date);
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
        events={allEvents}
        editable
        droppable
        eventDisplay="block"
        displayEventTime={false}
        eventDidMount={(info) => {
          const tip = info.event.extendedProps.tooltip as string | undefined;
          if (tip) info.el.setAttribute("title", tip);
        }}
        eventClick={(info) => {
          // 休假事件：點擊跳到「排班月檢視」管理該師傅休假，不要當成訂單
          if (info.event.extendedProps.isLeave) {
            const techId = info.event.extendedProps.techId as string | undefined;
            router.push(
              techId ? `/calendar/month?tech=${techId}` : "/calendar/month",
            );
            return;
          }
          router.push(`/orders/${info.event.id}?from=calendar`);
        }}
        dateClick={(info) =>
          router.push(`/orders/new?date=${info.dateStr}T09:00&from=calendar`)
        }
        eventDrop={(info) => {
          if (!info.event.start) {
            info.revert();
            return;
          }
          const startDate = new Date(info.event.start);
          const endDate = info.event.end
            ? new Date(info.event.end)
            : new Date(startDate.getTime() + 90 * 60_000);
          const durationMinutes = Math.max(
            15,
            Math.round((endDate.getTime() - startDate.getTime()) / 60_000),
          );
          // 衝突防呆：排除本身、檢查同師傅同日
          const techForSlot = techFilter === "all" ? null : techFilter;
          const slot = findFreeSlot(
            startDate,
            durationMinutes,
            orders,
            techForSlot,
            info.event.id,
          );
          if (slot.failed) {
            alert(`當天該師傅時段已排滿，無法移到此日。`);
            info.revert();
            return;
          }
          if (slot.shifted) {
            const pad = (n: number) => String(n).padStart(2, "0");
            const t = `${pad(slot.start.getHours())}:${pad(slot.start.getMinutes())}`;
            alert(`目標時段已被佔用，自動順延到 ${t}`);
          }
          const finalEnd = new Date(slot.start);
          finalEnd.setMinutes(finalEnd.getMinutes() + durationMinutes);
          const newStartIso = slot.start.toISOString();
          const newEndIso = finalEnd.toISOString();
          startTransition(async () => {
            const res = await rescheduleOrderAction(
              info.event.id,
              newStartIso,
              newEndIso,
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
          const dropTarget = info.event.start
            ? new Date(info.event.start)
            : null;
          if (!dropTarget) {
            info.event.remove();
            return;
          }
          // 客戶原始預約時段（若有）— 保留時段、只換日期
          const origStart = info.event.extendedProps.origStart as
            | string
            | null
            | undefined;
          const origEnd = info.event.extendedProps.origEnd as
            | string
            | null
            | undefined;
          // 訂單預計時長（永遠存在，預設 90）
          const orderDurationMin =
            (info.event.extendedProps.durationMinutes as number | undefined) ??
            90;

          const desired = new Date(dropTarget);
          let durationMinutes = orderDurationMin;
          if (origStart) {
            const os = new Date(origStart);
            if (!Number.isNaN(os.getTime())) {
              desired.setHours(os.getHours(), os.getMinutes(), 0, 0);
              if (origEnd) {
                const oe = new Date(origEnd);
                if (!Number.isNaN(oe.getTime()) && oe > os) {
                  durationMinutes = Math.round(
                    (oe.getTime() - os.getTime()) / 60000,
                  );
                }
              }
            } else {
              desired.setHours(9, 0, 0, 0);
            }
          } else {
            // 沒有原始預約時間 → 預設 09:00（避免 dayGrid 拖曳成午夜被 UTC 偏移）
            desired.setHours(9, 0, 0, 0);
          }

          // 衝突防呆：找空檔（同師傅同日）
          const techForSlot = techFilter === "all" ? null : techFilter;
          const slot = findFreeSlot(
            desired,
            durationMinutes,
            orders,
            techForSlot,
          );
          info.event.remove();
          if (slot.failed) {
            alert(
              `當天時段已排滿（22:00 前找不到 ${durationMinutes} 分鐘的空檔），請改派其他日期或師傅。`,
            );
            return;
          }
          if (slot.shifted) {
            const pad = (n: number) => String(n).padStart(2, "0");
            const t = `${pad(slot.start.getHours())}:${pad(slot.start.getMinutes())}`;
            alert(`原預設時段已被佔用，自動順延到 ${t}`);
          }
          const start = slot.start;
          const end = new Date(start);
          end.setMinutes(end.getMinutes() + durationMinutes);
          startTransition(async () => {
            const res = await quickScheduleAction({
              orderId,
              startIso: start.toISOString(),
              endIso: end.toISOString(),
              technicianId: techForSlot,
            });
            if (!res.ok) {
              alert(`派工失敗：${res.error}`);
            } else {
              router.refresh();
            }
          });
        }}
        eventContent={(arg) => {
          // Ghost event during drag from pending panel — show placeholder
          if (arg.event.extendedProps.fromPending) {
            return (
              <div className="px-1 text-xs opacity-70 truncate">
                {arg.event.title || "派工中..."}
              </div>
            );
          }
          // 休假事件：明確標示「🏖 師傅·全日休」，與訂單區隔，避免誤認尚未排案
          if (arg.event.extendedProps.isLeave) {
            const techName = arg.event.extendedProps.techName as string;
            const periodLabel = arg.event.extendedProps.periodLabel as string;
            return (
              <div className="flex items-center gap-1 px-1 text-xs font-medium leading-tight text-white">
                <span>🏖</span>
                <span className="whitespace-normal break-words">
                  {techName}·{periodLabel}
                </span>
              </div>
            );
          }
          const start = arg.event.extendedProps.start_time as string;
          const end = arg.event.extendedProps.end_time as string;
          const customer = arg.event.extendedProps.customer as string;
          const area = arg.event.extendedProps.area as string | null;
          const serviceSummary = arg.event.extendedProps.service_summary as string | null;
          const onCancel = (e: React.MouseEvent) => {
            e.stopPropagation();
            setActionTarget({ id: arg.event.id, customer });
          };
          return (
            <div className="group relative px-1 text-xs leading-tight space-y-0.5">
              <button
                type="button"
                onClick={onCancel}
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute right-0.5 top-0.5 z-10 hidden h-4 w-4 items-center justify-center rounded bg-black/40 text-[10px] font-bold leading-none text-white hover:bg-red-600 group-hover:flex"
                title="移出此排程"
              >
                ×
              </button>
              <div className="font-semibold tracking-tight">
                {start}–{end}
              </div>
              <div className="whitespace-normal break-words">
                {customer}
                {area ? ` · ${area}` : ""}
              </div>
              {serviceSummary && (
                <div className="whitespace-normal break-words opacity-75">
                  {serviceSummary}
                </div>
              )}
            </div>
          );
        }}
      />

      {actionTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeAll}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {!reasonOpen ? (
              <>
                <h2 className="text-base font-semibold text-zinc-900">
                  「{actionTarget.customer}」這筆排程
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  要怎麼處理？
                </p>
                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={handleUnschedule}
                    className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-left text-sm font-medium text-amber-900 hover:bg-amber-100"
                  >
                    <span className="block">↩ 回到待派工</span>
                    <span className="block text-xs font-normal text-amber-700/80">
                      移出月曆，等下要重派給其他師傅
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReasonOpen(true)}
                    className="w-full rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-left text-sm font-medium text-rose-900 hover:bg-rose-100"
                  >
                    <span className="block">✕ 取消此訂單</span>
                    <span className="block text-xs font-normal text-rose-700/80">
                      客戶取消、不會再做了
                    </span>
                  </button>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={closeAll}
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100"
                  >
                    關閉
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-zinc-900">
                  取消「{actionTarget.customer}」的訂單
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  請填取消原因（例：客戶臨時有事 / 客戶不在家 / 機器自行處理）
                </p>
                <textarea
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReasonOpen(false);
                      setReason("");
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100"
                  >
                    返回
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitCancel}
                    className="rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
                  >
                    確定取消
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
