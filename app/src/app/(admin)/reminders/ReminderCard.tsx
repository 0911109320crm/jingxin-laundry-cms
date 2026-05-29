"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Check, BellOff, MapPin } from "lucide-react";
import {
  markReminderSent,
  markReminderSkipped,
} from "@/app/(admin)/reminders/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import { PhoneList, type PhoneItem } from "@/components/customers/PhoneList";

export type ReminderItem = {
  id: string;
  due_date: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string;
    phones?: PhoneItem[];
  };
  last_service_at: string | null;
};

export function ReminderCard({
  reminder,
  readOnly = false,
}: {
  reminder: ReminderItem;
  readOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const message = `${reminder.customer.name} 您好，這裡是淨新清潔工坊 ☘️
您上次清洗服務在 ${formatDate(reminder.last_service_at)}，已經將近一年了。
為了維持您家電的乾淨與壽命，建議再次安排清洗服務。
有需要請回覆此訊息，我們會盡快為您安排。
— 淨新清潔工坊 0911-109320`;

  const onCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onSent = () => {
    if (!confirm(`標記「${reminder.customer.name}」已通知？`)) return;
    startTransition(async () => {
      const res = await markReminderSent(reminder.id);
      if (!res.ok) alert(res.error);
    });
  };

  const onSkip = () => {
    if (!confirm(`跳過「${reminder.customer.name}」？`)) return;
    startTransition(async () => {
      const res = await markReminderSkipped(reminder.id);
      if (!res.ok) alert(res.error);
    });
  };

  // Compute overdue badge
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(reminder.due_date);
  const daysDiff = Math.round(
    (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/customers/${reminder.customer.id}`}
              className="block truncate text-base font-semibold text-zinc-900 hover:underline"
            >
              {reminder.customer.name}
            </Link>
            <p className="mt-0.5 text-sm text-zinc-500">
              <PhoneList
                primary={reminder.customer.phone}
                phones={reminder.customer.phones}
                mode="inline"
              />
            </p>
          </div>
          {daysDiff > 0 ? (
            <span className="shrink-0 rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
              逾期 {daysDiff} 天
            </span>
          ) : daysDiff > -7 ? (
            <span className="shrink-0 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
              本週到期
            </span>
          ) : (
            <span className="shrink-0 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
              {Math.abs(daysDiff)} 天後到期
            </span>
          )}
        </div>
        <p className="flex items-start gap-1 text-xs text-zinc-500">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{reminder.customer.address}</span>
        </p>
        <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
          <p className="mb-1 font-medium text-zinc-700">上次服務</p>
          <p>{formatDate(reminder.last_service_at)}</p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCopy}
              className="flex-1"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> 已複製
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> 複製 LINE 文案
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSent}
              disabled={pending}
            >
              已通知
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onSkip}
              disabled={pending}
              title="跳過此客戶"
            >
              <BellOff className="h-4 w-4" />
            </Button>
          </div>
        )}
        {readOnly && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCopy}
            className="w-full"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" /> 已複製
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> 複製 LINE 文案（再發一次）
              </>
            )}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
