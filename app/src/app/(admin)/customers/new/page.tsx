import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { CustomerForm } from "@/components/customers/CustomerForm";

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; address?: string; name?: string }>;
}) {
  await requireRole(["owner", "manager"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: sources }, { data: brands }] = await Promise.all([
    supabase
      .from("customer_sources")
      .select("id, name")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("machine_brands")
      .select("category, name")
      .eq("active", true)
      .order("sort_order"),
  ]);

  return (
    <div className="p-6 space-y-4">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ChevronLeft className="h-4 w-4" /> 回顧客列表
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">新增顧客</h1>
        <p className="text-sm text-zinc-500">
          一次填完基本資料、地址、機器，未來訂單可直接套用
        </p>
      </header>
      <CustomerForm
        mode="create"
        sources={(sources as { id: string; name: string }[] | null) ?? []}
        machineBrands={(brands as { category: string; name: string }[] | null) ?? []}
        prefillPhone={sp.phone}
        prefillAddress={sp.address}
        prefillName={sp.name}
      />
    </div>
  );
}
