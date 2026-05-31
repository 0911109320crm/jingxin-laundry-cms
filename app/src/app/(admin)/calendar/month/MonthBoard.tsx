"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Plane } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  setTechnicianLeave,
  removeTechnicianLeave,
  type LeavePeriod,
} from "../leave-actions";

export type TechOpt = { id: string; name: string };
export type Assignment = {
  orderId: string;
  timeLabel: string;
  customerName: string;
  services: string;
  area: string;
  status: string;
};
export type DayCell = {
  date: string; // YYYY-MM-DD
  dayNum: number;
  weekday: string;
  isToday: boolean;
  isWeekend: boolean;
  assignments: Assignment[];
  amBusy: boolean;
  pmBusy: boolean;
  leave: LeavePeriod | null;
};

const LEAVE_LABEL: Record<LeavePeriod, string> = {
  full: "全日休",
  am: "上午休",
  pm: "下午休",
};

export function MonthBoard({
  techs,
  selectedTech,
  month,
  prevMonth,
  nextMonth,
  monthLabel,
  days,
  techParam,
}: {
  techs: TechOpt[];
  selectedTech: string;
  month: string;
  prevMonth: string;
  nextMonth: string;
  monthLabel: string;
  days: DayCell[];
  techParam: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyDate, setBusyDate] = useState<string | null>(null);

  const act = (date: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyDate(date);
    startTransition(async () => {
      const res = await fn();
      setBusyDate(null);
      if (!res.ok) {
        alert(res.error ?? "操作失敗");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* 師傅切換 */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-zinc-100 p-1">
        {techs.map((t) => (
          <Link
            key={t.id}
            href={`/calendar/month?tech=${t.id}&month=${month}`}
            data-active={t.id === selectedTech}
            className={cn(
              "inline-flex items-center rounded px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-white",
              "data-[active=true]:bg-brand-600 data-[active=true]:text-white",
            )}
          >
            {t.name}
          </Link>
        ))}
      </div>

      {/* 月份切換 */}
      <div className="flex items-center justify-between">
        <Link
          href={`/calendar/month?month=${prevMonth}${techParam}`}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          <ChevronLeft className="h-4 w-4" /> 上月
        </Link>
        <span className="text-base font-bold text-zinc-900">{monthLabel}</span>
        <Link
          href={`/calendar/month?month=${nextMonth}${techParam}`}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          下月 <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* 每日列表 */}
      <ul className="space-y-2">
        {days.map((d) => {
          const isBusy = pending && busyDate === d.date;
          return (
            <li
              key={d.date}
              className={cn(
                "rounded-xl border bg-white p-3",
                d.isToday ? "border-brand-400 ring-1 ring-brand-200" : "border-zinc-200",
              )}
            >
              <div className="flex items-start gap-3">
                {/* 日期欄 */}
                <div
                  className={cn(
                    "flex w-12 shrink-0 flex-col items-center rounded-lg py-1",
                    d.isToday
                      ? "bg-brand-600 text-white"
                      : d.isWeekend
                        ? "bg-rose-50 text-rose-600"
                        : "bg-zinc-100 text-zinc-700",
                  )}
                >
                  <span className="text-lg font-bold leading-none">{d.dayNum}</span>
                  <span className="text-[11px]">週{d.weekday}</span>
                </div>

                {/* 內容欄 */}
                <div className="min-w-0 flex-1 space-y-2">
                  {/* 派案卡片 */}
                  {d.assignments.length === 0 ? (
                    <p className="text-sm text-zinc-400">沒有派案</p>
                  ) : (
                    <div className="space-y-1.5">
                      {d.assignments.map((a) => (
                        <Link
                          key={a.orderId}
                          href={`/orders/${a.orderId}?from=calendar-month`}
                          className="block rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm hover:bg-zinc-100"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-brand-700">
                              {a.timeLabel}
                            </span>
                            <span className="shrink-0 font-medium text-zinc-900">
                              {a.customerName}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-zinc-600">
                              {a.services}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {a.area}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* 休假狀態 / 按鈕 */}
                  {d.leave ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        <Plane className="h-3 w-3" /> {LEAVE_LABEL[d.leave]}
                      </span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          act(d.date, () => removeTechnicianLeave(selectedTech, d.date))
                        }
                        className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        取消休假
                      </button>
                    </div>
                  ) : (
                    <LeaveButtons
                      amBusy={d.amBusy}
                      pmBusy={d.pmBusy}
                      disabled={isBusy}
                      onSet={(period) =>
                        act(d.date, () =>
                          setTechnicianLeave(selectedTech, d.date, period),
                        )
                      }
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LeaveButtons({
  amBusy,
  pmBusy,
  disabled,
  onSet,
}: {
  amBusy: boolean;
  pmBusy: boolean;
  disabled: boolean;
  onSet: (period: LeavePeriod) => void;
}) {
  // 上午有案→只能下午休；下午有案→只能上午休；都空→三種都可；都有案→排滿不顯示
  const options: LeavePeriod[] = [];
  if (!amBusy && !pmBusy) options.push("full", "am", "pm");
  else if (amBusy && !pmBusy) options.push("pm");
  else if (!amBusy && pmBusy) options.push("am");

  if (options.length === 0) {
    return <p className="text-xs text-zinc-400">上下午皆已派案</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((p) => (
        <button
          key={p}
          type="button"
          disabled={disabled}
          onClick={() => onSet(p)}
          className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        >
          {LEAVE_LABEL[p]}
        </button>
      ))}
    </div>
  );
}
