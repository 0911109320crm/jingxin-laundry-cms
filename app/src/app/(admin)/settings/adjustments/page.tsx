import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { AdjustmentRow, type Adjustment } from "./AdjustmentRow";
import { NewAdjustmentForm } from "./NewAdjustmentForm";
import { ADJ_CATEGORY_LABEL, ADJ_CATEGORY_ORDER } from "./categories";

const BLOCK_HINT: Record<string, string> = {
  service: "清洗服務相關加收（加大、車馬費、拆解費…）",
  parts: "維修更換零件加收，金額浮動可現場填；清單沒有的選「其他零件」並於備註註明",
  discount: "活動 / 團購 / 評論等優惠折扣",
};

export default async function AdjustmentsSettingsPage() {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("adjustment_items")
    .select("id, name, category, default_amount, active, affects_commission")
    .order("category")
    .order("name");

  const items = (data as Adjustment[] | null) ?? [];

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">折扣 / 加價項目</h1>
        <p className="text-sm text-zinc-500">
          分三大類管理：服務加收 / 零件加收 / 優惠折扣。訂單可套用多筆，預設金額是初值，現場可調整。
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          <strong>進薪資</strong>：勾選後這項會計入師傅薪資（如「加大費」勾、「節慶折扣」不勾）。零件是否進薪資由您逐項決定。
        </p>
      </header>

      {ADJ_CATEGORY_ORDER.map((cat) => {
        const list = items.filter((a) => a.category === cat);
        return (
          <Card key={cat}>
            <CardHeader>
              <CardTitle>
                {ADJ_CATEGORY_LABEL[cat]}（{list.length}）
              </CardTitle>
              <p className="mt-0.5 text-xs font-normal text-zinc-500">
                {BLOCK_HINT[cat]}
              </p>
            </CardHeader>
            <CardBody className="space-y-3">
              <NewAdjustmentForm category={cat} />

              {list.length === 0 ? (
                <p className="text-sm text-zinc-500">尚無項目</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <div className="hidden md:grid md:grid-cols-[1fr_110px_110px_110px_70px_auto] gap-2 border-b border-zinc-200 bg-zinc-50 px-5 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <div>名稱</div>
                    <div>分類</div>
                    <div>預設金額</div>
                    <div>進薪資</div>
                    <div>狀態</div>
                    <div></div>
                  </div>
                  <ul className="divide-y divide-zinc-200">
                    {list.map((a) => (
                      <li key={a.id}>
                        <AdjustmentRow adjustment={a} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
