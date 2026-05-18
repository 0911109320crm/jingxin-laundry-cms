import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { OrderForm } from "@/components/orders/OrderForm";
import { backTarget } from "@/lib/back";
import type { OrderInput } from "@/lib/validators/order";

type SP = Promise<{
  customer?: string;
  date?: string;
  clone?: string;
  from?: string;
  cid?: string;
}>;

export default async function NewOrderPage({ searchParams }: { searchParams: SP }) {
  await requireRole(["owner", "manager"]);
  const sp = await searchParams;
  const back = backTarget(sp);

  const supabase = await createClient();
  const admin = createAdminClient();

  const [
    { data: customers },
    { data: services },
    { data: adjustments },
    { data: techProfiles },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, code, name, phone")
      .order("name")
      .limit(500),
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
      .in("role", ["technician", "manager", "owner"])
      .order("name"),
  ]);

  // Clone support
  let cloneInitial: (OrderInput & { addresses?: never; machines?: never }) | undefined;
  if (sp.clone) {
    const { data: src } = await supabase
      .from("orders")
      .select(
        `customer_id, address_id, source,
         items:order_items(machine_id, service_item_id, technician_id,
                           quantity, unit_price, tag, note),
         adjustments:order_adjustments(adjustment_item_id, name_snapshot,
                                       type, amount, note)`,
      )
      .eq("id", sp.clone)
      .single();
    type RawClone = {
      customer_id: string;
      address_id: string;
      source: string | null;
      items: {
        machine_id: string | null;
        service_item_id: string;
        technician_id: string | null;
        quantity: number;
        unit_price: number;
        tag: string | null;
        note: string | null;
      }[];
      adjustments: {
        adjustment_item_id: string | null;
        name_snapshot: string;
        type: "addon" | "discount";
        amount: number;
        note: string | null;
      }[];
    };
    const s = src as RawClone | null;
    if (s) {
      cloneInitial = {
        customer_id: s.customer_id,
        address_id: s.address_id,
        scheduled_at: "",
        scheduled_end_at: "",
        service_at: "",
        status: "scheduled",
        payment_method: "unpaid",
        note: "",
        source: s.source ?? "",
        items: s.items.map((it) => ({
          machine_id: it.machine_id,
          service_item_id: it.service_item_id,
          technician_id: it.technician_id,
          quantity: it.quantity,
          unit_price: Number(it.unit_price),
          tag: it.tag ?? "",
          note: it.note ?? "",
        })),
        adjustments: s.adjustments.map((a) => ({
          adjustment_item_id: a.adjustment_item_id,
          name_snapshot: a.name_snapshot,
          type: a.type,
          amount: Number(a.amount),
          note: a.note ?? "",
        })),
      };
    }
  }

  return (
    <div className="p-8 space-y-5">
      <Link
        href={back.href}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ChevronLeft className="h-4 w-4" /> {back.label}
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">
          {sp.clone ? "新增訂單（複製自舊單）" : "新增訂單"}
        </h1>
        <p className="text-sm text-zinc-500">
          {sp.clone
            ? "已預填舊訂單內容，請確認日期、師傅後存檔"
            : "選客戶 → 帶出地址與機器 → 選服務指派師傅 → 加減項 → 存檔"}
        </p>
      </header>
      <OrderForm
        mode="create"
        customers={(customers ?? []) as { id: string; code: string; name: string; phone: string }[]}
        services={(services ?? []) as { id: string; code: string; name: string; default_price: number }[]}
        adjustments={(adjustments ?? []) as { id: string; name: string; type: "addon"|"discount"; default_amount: number }[]}
        technicians={(techProfiles ?? []) as { id: string; name: string }[]}
        defaultCustomerId={sp.customer ?? cloneInitial?.customer_id}
        defaultScheduledAt={sp.date}
        initial={cloneInitial}
        backHref={back.href}
      />
    </div>
  );
}
