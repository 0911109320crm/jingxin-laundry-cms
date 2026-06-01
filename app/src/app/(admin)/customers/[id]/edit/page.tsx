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
  referrer_id: string | null;
  phones: {
    id: string;
    phone: string;
    label: string | null;
    is_primary: boolean;
    sort_order: number;
  }[];
  addresses: (AddressInput & { id: string; merged_into_id?: string | null })[];
  machines: (MachineInput & { id: string; type: MachineType; address_id: string | null })[];
};

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["owner", "manager"]);
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: customer }, { data: sources }, { data: brands }] = await Promise.all([
    supabase
      .from("customers")
      .select(
        `id, code, name, phone, note, joined_at, source_id, referrer_id,
         phones:customer_phones(id, phone, label, is_primary, sort_order),
         addresses:customer_addresses(id, county, district, address, label, is_default, merged_into_id),
         machines(id, type, brand, model, sub_type, note, address_id)`,
      )
      .eq("id", id)
      .single(),
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

  const c = customer as EditData | null;
  if (!c) notFound();

  // phones：依 sort_order 排序；若 DB 沒有任何 phone（理論上不會發生），fallback 用 customers.phone 補一筆
  const sortedPhones = [...(c.phones ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const phonesForForm =
    sortedPhones.length > 0
      ? sortedPhones.map((p) => ({
          id: p.id,
          phone: p.phone,
          label: p.label ?? "",
          is_primary: !!p.is_primary,
        }))
      : [{ phone: c.phone, label: "", is_primary: true }];

  const initial: CustomerInput & { id: string } = {
    id: c.id,
    code: c.code,
    name: c.name,
    note: c.note ?? "",
    joined_at: c.joined_at ?? "",
    source_id: c.source_id,
    referrer_id: c.referrer_id ?? null,
    phones: phonesForForm,
    addresses: c.addresses.filter((a) => !a.merged_into_id).map((a) => ({
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
      address_id: m.address_id ?? null,
    })),
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/customers/${c.id}`}
          className="inline-flex shrink-0 items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
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
        machineBrands={(brands as { category: string; name: string }[] | null) ?? []}
      />
    </div>
  );
}
