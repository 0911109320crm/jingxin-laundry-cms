import { Card, CardBody } from "@/components/ui/Card";

export default function ReportsPage() {
  return (
    <div className="p-8 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">營業報表</h1>
        <p className="text-sm text-zinc-500">日 / 週 / 月切換，可匯出 CSV</p>
      </header>
      <Card>
        <CardBody>
          <p className="text-sm text-zinc-500">
            Phase 3 開發：營業額、項目 TOP、區域熱區、付款方式分布。
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
