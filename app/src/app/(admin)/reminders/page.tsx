import { BellRing, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody } from "@/components/ui/Card";
import { ReminderCard, type ReminderItem } from "./ReminderCard";
import { RefreshButton } from "./RefreshButton";

type Row = {
  id: string;
  due_date: string;
  status: "pending" | "sent" | "skipped";
  customer: {
    id: string;
    name: string;
    phone: string;
    addresses: { county: string; district: string; address: string; is_default: boolean }[];
  } | null;
  last_order: { service_at: string | null } | null;
};

export default async function RemindersPage() {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("reminders")
    .select(
      `id, due_date, status,
       customer:customers(id, name, phone, addresses:customer_addresses(county, district, address, is_default)),
       last_order:orders!reminders_last_order_id_fkey(service_at)`,
    )
    .eq("status", "pending")
    .order("due_date");

  const rows = (data as Row[] | null) ?? [];

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
          address: addr
            ? `${addr.county} ${addr.district} ${addr.address}`
            : "—",
        },
        last_service_at: r.last_order?.service_at ?? null,
      };
    });

  return (
    <div className="p-8 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">即將到期客戶</h1>
          <p className="text-sm text-zinc-500">
            上次服務在 11-13 個月前、之後沒再聯絡的客戶
          </p>
        </div>
        <RefreshButton />
      </header>

      {reminders.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-12">
            <BellRing className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">目前沒有即將到期的客戶</p>
            <p className="text-xs text-zinc-400">
              系統每天自動掃描；也可以點右上「重新掃描」立即更新
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reminders.map((r) => (
            <ReminderCard key={r.id} reminder={r} />
          ))}
        </div>
      )}
    </div>
  );
}
