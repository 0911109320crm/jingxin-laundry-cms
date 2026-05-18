import Link from "next/link";
import { Plus, Search, MapPin, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardBody } from "@/components/ui/Card";
import { COUNTIES, DISTRICTS_BY_COUNTY } from "@/lib/taiwan-regions";
import { formatDate } from "@/lib/utils";

type SearchParams = Promise<{
  q?: string;
  county?: string;
  district?: string;
}>;

type CustomerRow = {
  id: string;
  code: string;
  name: string;
  phone: string;
  note: string | null;
  joined_at: string | null;
  source: { name: string } | null;
  addresses: { county: string; district: string; address: string }[];
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["owner", "manager"]);
  const { q = "", county = "", district = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select(
      `id, code, name, phone, note, joined_at,
       source:customer_sources(name),
       addresses:customer_addresses(county, district, address)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const term = q.trim();
  if (term) {
    // multi-column fuzzy search using ilike (works fine on small data;
    // GIN trgm indexes will kick in via OR planner)
    const like = `%${term}%`;
    query = query.or(
      `name.ilike.${like},phone.ilike.${like},code.ilike.${like},note.ilike.${like}`,
    );
  }

  const { data, error } = await query;
  const customers = (data as CustomerRow[] | null) ?? [];

  const filtered = customers.filter((c) => {
    if (!county && !district) return true;
    return c.addresses.some(
      (a) =>
        (!county || a.county === county) &&
        (!district || a.district === district),
    );
  });

  const districts = county ? DISTRICTS_BY_COUNTY[county] ?? [] : [];

  return (
    <div className="p-8 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">顧客管理</h1>
          <p className="text-sm text-zinc-500">
            支援姓名 / 電話 / 編號 / 備註全域搜尋，可按縣市鄉鎮篩選
          </p>
        </div>
        <Link href="/customers/new">
          <Button>
            <Plus className="h-4 w-4" /> 新增顧客
          </Button>
        </Link>
      </header>

      <Card>
        <CardBody>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="搜尋姓名 / 電話 / 編號 / 備註"
                className="pl-9"
              />
            </div>
            <Select name="county" defaultValue={county}>
              <option value="">— 全部縣市 —</option>
              {COUNTIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select name="district" defaultValue={district} disabled={!county}>
              <option value="">— 全部鄉鎮 —</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            <Button type="submit">套用</Button>
          </form>
        </CardBody>
      </Card>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardBody>
            <p className="text-sm text-red-700">讀取失敗：{error.message}</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="p-0">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-500">
              沒有符合條件的顧客
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {filtered.map((c) => {
                const main = c.addresses[0];
                return (
                  <li key={c.id}>
                    <Link
                      href={`/customers/${c.id}`}
                      className="flex flex-col gap-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-900">
                            {c.name}
                          </span>
                          <span className="text-xs text-zinc-400">
                            {c.code}
                          </span>
                          {c.source?.name && (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                              {c.source.name}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </span>
                          {main && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {main.county} {main.district} {main.address}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400">
                        加入：{formatDate(c.joined_at)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <p className="text-xs text-zinc-400">
        顯示前 100 筆。若需更多請收斂搜尋條件。
      </p>
    </div>
  );
}
