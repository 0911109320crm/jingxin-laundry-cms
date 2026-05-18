import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { DeleteCustomerButton } from "./DeleteButton";
import type {
  AddressInput,
  CustomerInput,
  MachineInput,
} from "@/lib/validators/customer";
import type { MachineType } from "@/types/database";

type EditData = {
  id: string;
  code: string;
  name: string;
  phone: string;
  note: string | null;
  joined_at: string | null;
  source_id: string | null;
  addresses: (AddressInput & { id: string })[];
  machines: (MachineInput & { id: string; type: MachineType })[];
};

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["owner", "manager"]);
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: customer }, { data: sources }] = await Promise.all([
    supabase
      .from("customers")
      .select(
        `id, code, name, phone, note, joined_at, source_id,
         addresses:customer_addresses(id, county, district, address, label, is_default),
         machines(id, type, brand, model, sub_type, note)`,
      )
      .eq("id", id)
      .single(),
    supabase
      .from("customer_sources")
      .select("id, name")
      .eq("active", true)
      .order("sort_order"),
  ]);

  const c = customer as EditData | null;
  if (!c) notFound();

  const initial: CustomerInput & { id: string } = {
    id: c.id,
    code: c.code,
    name: c.name,
    phone: c.phone,
    note: c.note ?? "",
    joined_at: c.joined_at ?? "",
    source_id: c.source_id,
    addresses: c.addresses.map((a) => ({
      id: a.id,
      county: a.county,
      district: a.district,
      address: a.address,
      label: a.label ?? "",
      is_default: !!a.is_default,
    })),
    machines: c.machines.map((m) => ({
      id: m.id,
      type: m.type,
      brand: m.brand ?? "",
      model: m.model ?? "",
      sub_type: m.sub_type ?? "",
      note: m.note ?? "",
    })),
  };

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href={`/customers/${c.id}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ChevronLeft className="h-4 w-4" /> 回顧客詳情
        </Link>
        <DeleteCustomerButton id={c.id} name={c.name} />
      </div>
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">編輯顧客</h1>
        <p className="text-sm text-zinc-500">{c.name} · {c.code}</p>
      </header>
      <CustomerForm
        mode="edit"
        initial={initial}
        sources={(sources as { id: string; name: string }[] | null) ?? []}
      />
    </div>
  );
}
