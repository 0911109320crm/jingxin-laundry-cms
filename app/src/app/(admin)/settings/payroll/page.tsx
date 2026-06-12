import Link from "next/link";
import { Wallet, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  PayrollConstantsForm,
  type PayrollConstantsProps,
} from "./PayrollConstantsForm";

// 與 lib/payroll.ts 的 DEFAULT_CONSTANTS 一致（DB 沒設定時的 fallback）
const DEFAULTS: PayrollConstantsProps = {
  base_salary: 29900,
  base_units: 65,
  overage_unit_rate: 520,
  undismantled_bonus: 100,
  full_attendance_bonus: 2000,
  meal_base: 1200,
  meal_per_day: 50,
  marketing_threshold: 30,
  marketing_per_point: 10,
};

export default async function PayrollSettingsPage() {
  await requireRole(["owner"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "payroll_v2")
    .maybeSingle();

  const raw = (data as { value: Partial<PayrollConstantsProps> } | null)?.value;
  const constants: PayrollConstantsProps = { ...DEFAULTS };
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(DEFAULTS) as (keyof PayrollConstantsProps)[]) {
      const v = Number(raw[k]);
      if (Number.isFinite(v)) constants[k] = v;
    }
  }

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900">
          <Wallet className="h-6 w-6 text-emerald-500" />
          薪資設定
        </h1>
        <p className="text-sm text-zinc-500">
          算台數薪資的全店常數。各品項的「每台技術獎金」在
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
          <CardTitle>薪資常數</CardTitle>
        </CardHeader>
        <CardBody>
          <PayrollConstantsForm constants={constants} />
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
{`應發 = 本薪
     + 台數獎金（超過基本台數的台數 × 超額每台獎金）
     + 技術獎金（每台機型加給合計 + 未拆解台數 × 未拆解加給）
     + 全勤獎金（當月無休假登記才有）
     + 伙食津貼（固定 + 出勤日 × 日額）
     + 行銷獎金（超過門檻的積分 × 每分獎金）
     + 維修 / 執行 / 浮動（本月獎勵 − 本月扣款，手動填）`}
          </pre>
          <ul className="space-y-1.5 text-sm text-zinc-600">
            <li>
              <strong>台數</strong>：當月派給該師傅的機器台數（一台機器一筆），
              標記「不服務」與已取消的訂單不算。
            </li>
            <li>
              <strong>機型加給</strong>：依師傅實際選的品項，套用「
              <Link
                href="/settings/services"
                className="text-brand-600 hover:underline"
              >
                服務項目
              </Link>
              」的每台獎金（例：滾筒 760、吊隱式 340）。
            </li>
            <li>
              <strong>出勤日</strong>：當月有派案的日數（自動推算）。
            </li>
            <li>
              <strong>維修 / 執行 / 浮動</strong>：師傅薪資詳細頁底部手動加，每筆要填原因。
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
            已結算的月份：之後改薪資常數<strong>不會回頭影響</strong>歷史薪資。
          </p>
          <p>未結算的月份：永遠用最新設定即時計算。</p>
        </CardBody>
      </Card>
    </div>
  );
}
