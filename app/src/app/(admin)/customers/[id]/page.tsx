import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Pencil,
  Phone,
  MapPin,
  Wrench,
  History,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate, formatNTD } from "@/lib/utils";
import { MACHINE_TYPE_LABEL } from "@/lib/validators/customer";
import {
  StatusBadge,
  PaymentBadge,
  SettlementBadge,
} from "@/components/orders/StatusBadges";
import type { MachineType } from "@/types/database";
import type { OrderInput } from "@/lib/validators/order";

type CustomerDetail = {
  id: string;
  code: string;
  name: string;
  phone: string;
  note: string | null;
  joined_at: string | null;
  source: { name: string } | null;
  addresses: {
    id: string;
    county: string;
    district: string;
    address: string;
    label: string | null;
    is_default: boolean;
  }[];
  machines: {
    id: string;
    type: MachineType;
    brand: string | null;
    model: string | null;
    sub_type: string | null;
    note: string | null;
  }[];
};

type OrderRow = {
  id: string;
  order_code: string;
  scheduled_at: string | null;
  service_at: string | null;
  status: OrderInput["status"];
  payment_method: OrderInput["payment_method"];
  settlement_status: "pending" | "settled" | "not_required";
  total: number;
  cancellation_reason: string | null;
  items: {
    technician_id: string | null;
    service: { name: string } | null;
  }[];
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["owner", "manager"]);
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data }, { data: ordersData }] = await Promise.all([
    supabase
      .from("customers")
      .select(
        `id, code, name, phone, note, joined_at,
         source:customer_sources(name),
         addresses:customer_addresses(id, county, district, address, label, is_default),
         machines(id, type, brand, model, sub_type, note)`,
      )
      .eq("id", id)
      .single(),
    supabase
      .from("orders")
      .select(
        `id, order_code, scheduled_at, service_at, status, payment_method,
         settlement_status, total,
         items:order_items(technician_id, service:service_items(name))`,
      )
      .eq("customer_id", id)
      .order("scheduled_at", { ascending: false, nullsFirst: false }),
  ]);

  const customer = data as CustomerDetail | null;
  if (!customer) notFound();

  const orders = (ordersData as OrderRow[] | null) ?? [];

  // Resolve technician names
  const techIds = Array.from(
    new Set(
      orders
        .flatMap((o) => o.items.map((it) => it.technician_id))
        .filter(Boolean) as string[],
    ),
  );
  let techMap = new Map<string, string>();
  if (techIds.length > 0) {
    const { data: techs } = await admin
      .from("user_profiles")
      .select("id, name")
      .in("id", techIds);
    techMap = new Map(
      ((techs ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]),
    );
  }

  const totalSpent = orders
    .filter((o) => o.status === "done")
    .reduce((s, o) => s + Number(o.total), 0);
  const doneCount = orders.filter((o) => o.status === "done").length;
  const cancelCount = orders.filter((o) => o.status === "cancelled").length;

  return (
    <div className="p-8 space-y-5">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ChevronLeft className="h-4 w-4" /> 回顧客列表
      </Link>

      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-900">{customer.name}</h1>
            <span className="text-sm text-zinc-400">{customer.code}</span>
            {customer.source?.name && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                {customer.source.name}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            加入日期：{formatDate(customer.joined_at)} · 累計消費{" "}
            <span className="font-semibold text-zinc-900">
              {formatNTD(totalSpent)}
            </span>{" "}
            ({doneCount} 次)
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/orders/new?customer=${customer.id}&from=customer&cid=${customer.id}`}
          >
            <Button>
              <Plus className="h-4 w-4" /> 新增訂單
            </Button>
          </Link>
          <Link href={`/customers/${customer.id}/edit`}>
            <Button variant="outline">
              <Pencil className="h-4 w-4" /> 編輯
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>聯絡資訊</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-zinc-400" />
              <span>{customer.phone}</span>
            </div>
            {customer.note && (
              <div className="rounded-lg bg-zinc-50 p-3 text-zinc-700">
                <p className="mb-1 text-xs text-zinc-500">備註</p>
                {customer.note}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>地址（{customer.addresses.length} 筆）</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {customer.addresses.length === 0 && (
              <p className="text-sm text-zinc-500">尚無地址</p>
            )}
            {customer.addresses.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border border-zinc-200 p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-zinc-400" />
                  <span className="font-medium">
                    {a.county} {a.district}
                  </span>
                  {a.label && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                      {a.label}
                    </span>
                  )}
                  {a.is_default && (
                    <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">
                      預設
                    </span>
                  )}
                </div>
                <p className="mt-1 text-zinc-700">{a.address}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>機器 / 服務物品（{customer.machines.length} 筆）</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {customer.machines.length === 0 && (
            <p className="text-sm text-zinc-500">尚未登錄機器</p>
          )}
          {customer.machines.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-zinc-200 p-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-zinc-400" />
                <span className="font-medium">
                  {MACHINE_TYPE_LABEL[m.type] ?? m.type}
                </span>
                {m.sub_type && (
                  <span className="text-xs text-zinc-500">{m.sub_type}</span>
                )}
              </div>
              <p className="mt-1 text-zinc-700">
                {[m.brand, m.model].filter(Boolean).join(" / ") || "—"}
              </p>
              {m.note && (
                <p className="mt-1 text-xs text-zinc-500">備註：{m.note}</p>
              )}
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-500" />
            服務歷史（{orders.length} 筆）
            {cancelCount > 0 && (
              <span
                className={`ml-2 rounded px-2 py-0.5 text-xs font-medium ${
                  cancelCount >= 3
                    ? "bg-rose-100 text-rose-800"
                    : "bg-amber-50 text-amber-700"
                }`}
                title={cancelCount >= 3 ? "此客戶常臨時取消" : ""}
              >
                臨時取消 {cancelCount} 次
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {orders.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">尚無服務紀錄</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {orders.map((o) => {
                const services = o.items
                  .map((it) => it.service?.name)
                  .filter(Boolean) as string[];
                const techIds = Array.from(
                  new Set(
                    o.items.map((it) => it.technician_id).filter(Boolean),
                  ),
                ) as string[];
                const techNames = techIds
                  .map((tid) => techMap.get(tid))
                  .filter(Boolean) as string[];
                return (
                  <li key={o.id}>
                    <Link
                      href={`/orders/${o.id}?from=customer&cid=${customer.id}`}
                      className="flex flex-col gap-2 px-5 py-3 transition-colors hover:bg-zinc-50 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-zinc-500">
                            {o.order_code}
                          </span>
                          <StatusBadge value={o.status} />
                          <PaymentBadge value={o.payment_method} />
                          {o.settlement_status !== "not_required" && (
                            <SettlementBadge value={o.settlement_status} />
                          )}
                        </div>
                        <p className="text-sm text-zinc-700">
                          {services.length > 0
                            ? services.join("、")
                            : "未填服務"}
                        </p>
                        {techNames.length > 0 && (
                          <p className="text-xs text-zinc-500">
                            師傅：{techNames.join("、")}
                          </p>
                        )}
                        {o.status === "cancelled" && o.cancellation_reason && (
                          <p className="text-xs text-rose-700">
                            取消原因：{o.cancellation_reason}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-400">
                          {formatDate(o.service_at ?? o.scheduled_at)}
                        </p>
                        <p className="font-mono font-semibold text-zinc-900">
                          {formatNTD(o.total)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
