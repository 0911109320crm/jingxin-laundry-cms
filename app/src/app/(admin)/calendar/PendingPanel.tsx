"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Draggable } from "@fullcalendar/interaction";
import { MapPin, Phone, ClipboardList, GripVertical, Clock } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

export type PendingOrder = {
  id: string;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  service_summary: string;
  total: number;
  has_technician: boolean;
  scheduled_at: string | null;
  scheduled_end_at: string | null;
};

function formatTimeSlot(startIso: string | null, endIso: string | null): string | null {
  if (!startIso) return null;
  const s = new Date(startIso);
  if (Number.isNaN(s.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateLabel = `${s.getMonth() + 1}/${s.getDate()}`;
  const startTime = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
  if (!endIso) return `${dateLabel} ${startTime}`;
  const e = new Date(endIso);
  if (Number.isNaN(e.getTime())) return `${dateLabel} ${startTime}`;
  const endTime = `${pad(e.getHours())}:${pad(e.getMinutes())}`;
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
        return {
          title,
          duration: "01:30",
          create: true,
          extendedProps: { orderId, fromPending: true },
        };
      },
    });
    return () => draggable.destroy();
  }, [orders.length]);

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
                    className="pending-draggable group relative cursor-grab select-none px-4 py-3 transition-colors hover:bg-amber-50 active:cursor-grabbing"
                    data-order-id={o.id}
                    data-title={o.customer_name}
                    title="拖拉到月曆某日排定"
                  >
                    <GripVertical className="absolute right-2 top-3 h-4 w-4 text-zinc-300 group-hover:text-zinc-500" />
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-mono">{o.order_code}</span>
                      {!o.has_technician && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                          未指派
                        </span>
                      )}
                    </div>
                    {slot ? (
                      <p className="mt-1 inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
                        <Clock className="h-3 w-3" />
                        客戶預約 {slot}
                      </p>
                    ) : (
                      <p className="mt-1 inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                        <Clock className="h-3 w-3" />
                        未指定時段
                      </p>
                    )}
                    <p className="mt-1 text-sm font-semibold text-zinc-900">
                      {o.customer_name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                      <Phone className="h-3 w-3" /> {o.customer_phone}
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
                );
              })}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
