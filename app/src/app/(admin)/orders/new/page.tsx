import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { OrderForm } from "@/components/orders/OrderForm";
import { backTarget } from "@/lib/back";

type SP = Promise<{
  customer?: string;
  date?: string;
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

  return (
    <div className="p-8 space-y-5">
      <Link
        href={back.href}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ChevronLeft className="h-4 w-4" /> {back.label}
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">新增訂單</h1>
        <p className="text-sm text-zinc-500">
          選客戶 → 帶出地址與機器 → 選服務指派師傅 → 加減項 → 存檔
        </p>
      </header>
      <OrderForm
        mode="create"
        customers={(customers ?? []) as { id: string; code: string; name: string; phone: string }[]}
        services={(services ?? []) as { id: string; code: string; name: string; default_price: number }[]}
        adjustments={(adjustments ?? []) as { id: string; name: string; type: "addon"|"discount"; default_amount: number }[]}
        technicians={(techProfiles ?? []) as { id: string; name: string }[]}
        defaultCustomerId={sp.customer}
        defaultScheduledAt={sp.date}
        backHref={back.href}
      />
    </div>
  );
}
