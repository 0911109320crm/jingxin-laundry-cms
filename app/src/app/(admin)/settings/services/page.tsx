import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ServiceRow, type Service } from "./ServiceRow";
import { NewServiceForm } from "./NewServiceForm";

export default async function ServicesSettingsPage() {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_items")
    .select("id, code, name, default_price, category, sort_order, active")
    .order("sort_order");

  const items = (data as Service[] | null) ?? [];

  return (
    <div className="p-8 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">服務項目</h1>
        <p className="text-sm text-zinc-500">
          代碼（貼紙）+ 名稱 + 預設價。預設價是建立訂單時的初值，可在訂單頁調整。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>新增項目</CardTitle>
        </CardHeader>
        <CardBody>
          <NewServiceForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>項目清單（{items.length}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <div className="grid grid-cols-[80px_1fr_100px_120px_80px_70px_auto] gap-2 border-b border-zinc-200 bg-zinc-50 px-5 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <div>代碼</div>
            <div>名稱</div>
            <div>預設價</div>
            <div>分類</div>
            <div>排序</div>
            <div>狀態</div>
            <div></div>
          </div>
          {items.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">尚無資料</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {items.map((s) => (
                <li key={s.id}>
                  <ServiceRow service={s} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
