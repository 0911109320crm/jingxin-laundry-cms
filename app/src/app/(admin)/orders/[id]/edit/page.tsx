import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { OrderForm } from "@/components/orders/OrderForm";
import { CancelOrderButton } from "../CancelOrderButton";
import { backTarget } from "@/lib/back";
import type { OrderInput } from "@/lib/validators/order";

export default async function EditOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; cid?: string }>;
}) {
  await requireRole(["owner", "manager"]);
  const { id } = await params;
  const sp = await searchParams;
  const back = backTarget(sp, `/orders/${id}`);
  const supabase = await createClient();
  const admin = createAdminClient();

  const [
    { data: order },
    { data: services },
    { data: adjustments },
    { data: technicians },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, order_code, customer_id, address_id, scheduled_at, scheduled_end_at,
         service_at, duration_minutes, status, payment_method, note, source,
         items:order_items(id, machine_id, service_item_id, technician_id,
                           quantity, unit_price, tag, note),
         adjustments:order_adjustments(id, adjustment_item_id, name_snapshot,
                                       type, amount, note)`,
      )
      .eq("id", id)
      .single(),
    supabase
      .from("service_items")
      .select("id, code, name, default_price")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("adjustment_items")
      .select("id, name, type, default_amount")
      .eq("active", true)
      .order("type, name"),
    admin
      .from("user_profiles")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  const o = order as
    | {
        id: string;
        order_code: string;
        customer_id: string;
        address_id: string;
        scheduled_at: string | null;
        scheduled_end_at: string | null;
        service_at: string | null;
        duration_minutes: number | null;
        status: OrderInput["status"];
        payment_method: OrderInput["payment_method"];
        note: string | null;
        source: string | null;
        items: {
          id: string;
          machine_id: string | null;
          service_item_id: string;
          technician_id: string | null;
          quantity: number;
          unit_price: number;
          tag: string | null;
          note: string | null;
        }[];
        adjustments: {
          id: string;
          adjustment_item_id: string | null;
          name_snapshot: string;
          type: "addon" | "discount";
          amount: number;
          note: string | null;
        }[];
      }
    | null;
  if (!o) notFound();

  // Load addresses + machines for the current customer so the form pre-populates
  const [{ data: addresses }, { data: machines }] = await Promise.all([
    supabase
      .from("customer_addresses")
      .select("id, county, district, address, label, is_default")
      .eq("customer_id", o.customer_id)
      .order("is_default", { ascending: false }),
    supabase
      .from("machines")
      .select("id, type, brand, model, sub_type, note")
      .eq("customer_id", o.customer_id),
  ]);

  // Normalize date-time to "YYYY-MM-DDTHH:mm" for <input type="datetime-local">
  const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const initial: OrderInput & {
    id: string;
    addresses: typeof addresses extends null ? [] : NonNullable<typeof addresses>;
    machines: typeof machines extends null ? [] : NonNullable<typeof machines>;
  } = {
    id: o.id,
    customer_id: o.customer_id,
    address_id: o.address_id,
    scheduled_at: toLocalInput(o.scheduled_at),
    scheduled_end_at: toLocalInput(o.scheduled_end_at),
    service_at: toLocalInput(o.service_at),
    duration_minutes: o.duration_minutes ?? 90,
    status: o.status,
    payment_method: o.payment_method,
    note: o.note ?? "",
    source: o.source ?? "",
    items: o.items.map((it) => ({
      id: it.id,
      machine_id: it.machine_id,
      service_item_id: it.service_item_id,
      technician_id: it.technician_id,
      quantity: it.quantity,
      unit_price: Number(it.unit_price),
      tag: it.tag ?? "",
      note: it.note ?? "",
    })),
    adjustments: o.adjustments.map((a) => ({
      id: a.id,
      adjustment_item_id: a.adjustment_item_id,
      name_snapshot: a.name_snapshot,
      type: a.type,
      amount: Number(a.amount),
      note: a.note ?? "",
    })),
    addresses: (addresses ?? []) as never,
    machines: (machines ?? []) as never,
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={back.href}
          className="inline-flex shrink-0 items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ChevronLeft className="h-4 w-4" /> {back.label}
        </Link>
        {o.status !== "cancelled" && (
          <CancelOrderButton
            id={o.id}
            orderCode={o.order_code}
            redirectTo={back.href}
          />
        )}
      </div>
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">編輯訂單</h1>
      </header>
      <OrderForm
        mode="edit"
        initial={initial}
        orderCode={o?.order_code}
        services={(services ?? []) as { id: string; code: string; name: string; default_price: number }[]}
        adjustments={(adjustments ?? []) as { id: string; name: string; type: "addon"|"discount"; default_amount: number }[]}
        technicians={(technicians ?? []) as { id: string; name: string }[]}
        backHref={back.href}
      />
    </div>
  );
}
