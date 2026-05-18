import Link from "next/link";
import { CheckCheck, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody } from "@/components/ui/Card";
import { formatNTD } from "@/lib/utils";

export default async function PayrollPage() {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();

  const { count: pendingCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("payment_method", "cash")
    .eq("settlement_status", "pending");

  const { data: pendingSum } = await supabase
    .from("orders")
    .select("total")
    .eq("payment_method", "cash")
    .eq("settlement_status", "pending");

  const totalPending =
    ((pendingSum as { total: number }[] | null) ?? []).reduce(
      (s, o) => s + Number(o.total),
      0,
    );

  return (
    <div className="p-8 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">師傅薪資 / 回繳</h1>
        <p className="text-sm text-zinc-500">
          核對師傅現金回繳、產出計件薪資月報
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link href="/payroll/settlements">
          <Card className="transition-shadow hover:shadow-md">
            <CardBody>
              <div className="flex items-center gap-3">
                <CheckCheck className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-base font-semibold text-zinc-900">
                    師傅待回繳
                  </p>
                  <p className="text-sm text-zinc-500">
                    {pendingCount ?? 0} 筆 · {formatNTD(totalPending)}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </Link>

        <Card className="opacity-60">
          <CardBody>
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-zinc-400" />
              <div>
                <p className="text-base font-semibold text-zinc-900">
                  計件薪資月報
                </p>
                <p className="text-sm text-zinc-500">
                  Phase 3 開發中（依「2026年五月份」Excel 版型）
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
