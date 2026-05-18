import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { SourceRow, type Source } from "./SourceRow";
import { NewSourceForm } from "./NewSourceForm";

export default async function SourcesSettingsPage() {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_sources")
    .select("id, name, sort_order, active")
    .order("sort_order");

  const sources = (data as Source[] | null) ?? [];

  return (
    <div className="p-8 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">客戶來源</h1>
        <p className="text-sm text-zinc-500">
          可自由增刪。停用的項目仍會在舊客戶資料保留，但新增客戶時不會顯示。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>新增來源</CardTitle>
        </CardHeader>
        <CardBody>
          <NewSourceForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>來源清單（{sources.length}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {sources.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">尚無資料</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {sources.map((s) => (
                <li key={s.id}>
                  <SourceRow source={s} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
