import Link from "next/link";
import { BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody } from "@/components/ui/Card";
import { ReminderCard, type ReminderItem } from "./ReminderCard";
import { RefreshButton } from "./RefreshButton";

type ReminderStatus = "pending" | "sent" | "skipped";

type Row = {
  id: string;
  due_date: string;
  status: ReminderStatus;
  sent_at: string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
    phones: { id: string; phone: string; label: string | null; is_primary: boolean }[];
    addresses: { county: string; district: string; address: string; is_default: boolean }[];
  } | null;
  last_order: { service_at: string | null } | null;
};

type SP = Promise<{ status?: ReminderStatus }>;

const TABS: { key: ReminderStatus; label: string }[] = [
  { key: "pending", label: "待通知" },
  { key: "sent", label: "已通知" },
  { key: "skipped", label: "已跳過" },
];

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await requireRole(["owner", "manager"]);
  const sp = await searchParams;
  const status: ReminderStatus = (sp.status ?? "pending") as ReminderStatus;
  const supabase = await createClient();

  const [{ data }, { count: pendingCount }, { count: sentCount }, { count: skippedCount }] =
    await Promise.all([
      supabase
        .from("reminders")
        .select(
          `id, due_date, status, sent_at,
           customer:customers(id, name, phone,
                            phones:customer_phones(id, phone, label, is_primary),
                            addresses:customer_addresses(county, district, address, is_default)),
           last_order:orders!reminders_last_order_id_fkey(service_at)`,
        )
        .eq("status", status)
        .order(status === "sent" ? "sent_at" : "due_date", { ascending: false }),
      supabase
        .from("reminders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("reminders")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent"),
      supabase
        .from("reminders")
        .select("*", { count: "exact", head: true })
        .eq("status", "skipped"),
    ]);

  const rows = (data as Row[] | null) ?? [];
  const counts: Record<ReminderStatus, number> = {
    pending: pendingCount ?? 0,
    sent: sentCount ?? 0,
    skipped: skippedCount ?? 0,
  };

  const reminders: ReminderItem[] = rows
    .filter((r) => r.customer)
    .map((r) => {
      const addr =
        r.customer!.addresses.find((a) => a.is_default) ??
        r.customer!.addresses[0];
      return {
        id: r.id,
        due_date: r.due_date,
        customer: {
          id: r.customer!.id,
          name: r.customer!.name,
          phone: r.customer!.phone,
          phones: r.customer!.phones ?? [],
          address: addr
            ? `${addr.county} ${addr.district} ${addr.address}`
            : "—",
        },
        last_service_at: r.last_order?.service_at ?? null,
      };
    });

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900">即將到期客戶</h1>
          <p className="text-sm text-zinc-500">
            上次服務在 11-13 個月前、之後沒再聯絡的客戶
          </p>
        </div>
        <RefreshButton />
      </header>

      <div className="flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/reminders?status=${t.key}`}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              status === t.key
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:bg-white/60"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-zinc-400">
              {counts[t.key]}
            </span>
          </Link>
        ))}
      </div>

      {reminders.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-12">
            <BellRing className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              {status === "pending"
                ? "目前沒有即將到期的客戶"
                : status === "sent"
                  ? "尚無已通知紀錄"
                  : "尚無已跳過紀錄"}
            </p>
            {status === "pending" && (
              <p className="text-xs text-zinc-400">
                系統每天自動掃描；也可以點右上「重新掃描」立即更新
              </p>
            )}
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reminders.map((r) => (
            <ReminderCard key={r.id} reminder={r} readOnly={status !== "pending"} />
          ))}
        </div>
      )}
    </div>
  );
}
