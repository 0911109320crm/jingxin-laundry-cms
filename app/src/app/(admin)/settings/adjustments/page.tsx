import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { AdjustmentRow, type Adjustment } from "./AdjustmentRow";
import { NewAdjustmentForm } from "./NewAdjustmentForm";

export default async function AdjustmentsSettingsPage() {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("adjustment_items")
    .select("id, name, type, default_amount, active, affects_commission")
    .order("type, name");

  const items = (data as Adjustment[] | null) ?? [];

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">折扣 / 加價項目</h1>
        <p className="text-sm text-zinc-500">
          訂單可套用多筆。預設金額是建立時的初值，現場可調整。
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          <strong>進薪資</strong>：勾選後，這項加減項會計入師傅薪資（如「加大費」勾、「節慶折扣」不勾）。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>新增項目</CardTitle>
        </CardHeader>
        <CardBody>
          <NewAdjustmentForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>項目清單（{items.length}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <div className="grid grid-cols-[1fr_110px_110px_110px_70px_auto] gap-2 border-b border-zinc-200 bg-zinc-50 px-5 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <div>名稱</div>
            <div>類型</div>
            <div>預設金額</div>
            <div>進薪資</div>
            <div>狀態</div>
            <div></div>
          </div>
          {items.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">尚無資料</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {items.map((a) => (
                <li key={a.id}>
                  <AdjustmentRow adjustment={a} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
