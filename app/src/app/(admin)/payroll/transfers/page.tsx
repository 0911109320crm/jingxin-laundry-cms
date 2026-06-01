import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card } from "@/components/ui/Card";
import { formatNTD } from "@/lib/utils";
import { TransferReconcile, type TransferRow } from "./TransferReconcile";

type Row = {
  id: string;
  order_code: string;
  total: number;
  service_at: string | null;
  scheduled_at: string | null;
  transfer_last5: string | null;
  customer: { name: string } | null;
  address: { county: string; district: string } | null;
};

export default async function TransfersReconcilePage() {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      `id, order_code, total, service_at, scheduled_at, transfer_last5,
       customer:customers(name),
       address:customer_addresses(county, district)`,
    )
    .eq("payment_method", "transfer")
    .eq("settlement_status", "pending")
    .order("service_at", { ascending: true, nullsFirst: false });

  const rows = (data as Row[] | null) ?? [];
  const orders: TransferRow[] = rows.map((o) => ({
    id: o.id,
    order_code: o.order_code,
    total: Number(o.total),
    date: o.service_at ?? o.scheduled_at,
    customer_name: o.customer?.name ?? "—",
    area: o.address ? `${o.address.county} ${o.address.district}` : null,
    transfer_last5: o.transfer_last5,
  }));

  const grandTotal = orders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="p-6 space-y-4">
      <Link
        href="/payroll"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ChevronLeft className="h-4 w-4" /> 回師傅薪資
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900">轉帳待對帳</h1>
          <p className="text-sm text-zinc-500">
            客戶選擇轉帳的訂單。比對銀行入帳明細（看末五碼）後，勾選並「標記已入帳」。
          </p>
        </div>
        <Card className="shrink-0 px-5 py-3">
          <p className="text-xs text-zinc-500">待對帳總額</p>
          <p className="font-mono text-2xl font-bold text-blue-700">
            {formatNTD(grandTotal)}
          </p>
          <p className="text-xs text-zinc-500">{orders.length} 筆</p>
        </Card>
      </header>

      <Card className="p-4">
        <TransferReconcile orders={orders} />
      </Card>
    </div>
  );
}
