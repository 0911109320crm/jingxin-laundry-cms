import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { PromotionTypeRow, type PromotionType } from "./PromotionTypeRow";
import { NewPromotionTypeForm } from "./NewPromotionTypeForm";
import { KpiSettingForm } from "./KpiSettingForm";

export default async function PromotionTypesPage() {
  const user = await requireRole(["owner", "manager"]);
  const isOwner = user.profile.role === "owner";

  const supabase = await createClient();
  const [{ data: types }, { data: kpiRow }] = await Promise.all([
    supabase
      .from("promotion_types")
      .select("id, code, label, points, sort_order, active")
      .order("sort_order"),
    supabase
      .from("system_settings")
      .select("value")
      .eq("key", "monthly_promotion_kpi")
      .maybeSingle(),
  ]);

  const promos = (types as PromotionType[] | null) ?? [];
  const kpiValue = typeof kpiRow?.value === "number" ? kpiRow.value : 30;

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">促銷積分管理</h1>
        <p className="text-sm text-zinc-500">
          師傅在每筆訂單可勾選「客戶做了哪些促銷動作」，加總分數計入師傅本月 KPI。
          停用的項目師傅 PWA 不顯示，但舊紀錄保留。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>每月積分 KPI 目標</CardTitle>
        </CardHeader>
        <CardBody>
          <KpiSettingForm currentValue={kpiValue} disabled={!isOwner} />
          {!isOwner && (
            <p className="mt-2 text-xs text-zinc-500">僅老闆可調整 KPI 設定</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>新增促銷類型</CardTitle>
        </CardHeader>
        <CardBody>
          <NewPromotionTypeForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>促銷清單（{promos.length}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {promos.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">尚無資料</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {promos.map((p) => (
                <li key={p.id}>
                  <PromotionTypeRow promo={p} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
