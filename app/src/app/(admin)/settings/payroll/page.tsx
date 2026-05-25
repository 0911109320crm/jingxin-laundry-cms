import Link from "next/link";
import { Wallet, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { DefaultCommissionForm } from "./DefaultCommissionForm";

export default async function PayrollSettingsPage() {
  await requireRole(["owner"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", [
      "default_commission_type",
      "default_commission_value",
      "payroll_kpi_disclaimer",
    ]);

  const map = new Map(
    ((data as { key: string; value: unknown }[] | null) ?? []).map((r) => [
      r.key,
      r.value,
    ]),
  );

  const defaultType =
    (map.get("default_commission_type") as "percent" | "amount" | undefined) ??
    "percent";
  const defaultValue = Number(map.get("default_commission_value") ?? 60);
  const formula =
    (map.get("payroll_kpi_disclaimer") as string | undefined) ??
    "薪資 = Σ(每件抽成) + Σ(進薪資的加價) − Σ(進薪資的折扣) + Σ(本月獎勵) − Σ(本月扣款)";

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900">
          <Wallet className="h-6 w-6 text-emerald-500" />
          薪資設定
        </h1>
        <p className="text-sm text-zinc-500">
          全店預設抽成方式與薪資計算公式說明。個別服務項目的抽成在
          <Link
            href="/settings/services"
            className="text-brand-600 hover:underline"
          >
            服務項目
          </Link>
          設定。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>預設抽成（fallback）</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-zinc-600">
            服務項目沒設定抽成（或設為「預設」）時，套用以下數值：
          </p>
          <DefaultCommissionForm
            defaultType={defaultType}
            defaultValue={defaultValue}
          />
          <div className="rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            <strong>百分比範例：</strong>「60%」表示服務金額的 60% 給師傅，店家收 40%。
            <br />
            <strong>固定金額範例：</strong>「500」表示不管該服務多少錢，師傅一件抽 NT$ 500。
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 text-zinc-500" />
            薪資計算公式
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <pre className="overflow-x-auto rounded-lg bg-zinc-900 px-4 py-3 text-xs text-emerald-300">
            {formula}
          </pre>
          <ul className="space-y-1.5 text-sm text-zinc-600">
            <li>
              <strong>每件抽成</strong>：每筆訂單明細按該服務項目的抽成設定計算（沒設就套用上面的預設值）
            </li>
            <li>
              <strong>進薪資的加價 / 折扣</strong>：在「
              <Link
                href="/settings/adjustments"
                className="text-brand-600 hover:underline"
              >
                折扣 / 加價項目
              </Link>
              」勾選「進薪資」的項目才算進去。例如「加大費」勾、「節慶折扣」不勾。
            </li>
            <li>
              <strong>本月獎勵 / 扣款</strong>：師傅薪資詳細頁底部可手動加，每筆要填原因
            </li>
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 text-zinc-500" />
            月結與歷史鎖定
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-zinc-600">
          <p>
            月底在師傅薪資頁按「<strong>結算本月</strong>」會把當月計算結果 snapshot 起來。
          </p>
          <p>
            已結算的月份：之後改抽成設定<strong>不會回頭影響</strong>歷史薪資。
          </p>
          <p>
            未結算的月份：永遠用最新設定即時計算。
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
