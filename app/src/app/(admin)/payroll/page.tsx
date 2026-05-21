import Link from "next/link";
import { CheckCheck, FileText, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatNTD } from "@/lib/utils";

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function PayrollPage() {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ count: pendingCount }, { data: pendingSum }, { data: technicians }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("payment_method", "cash")
        .eq("settlement_status", "pending"),
      supabase
        .from("orders")
        .select("total")
        .eq("payment_method", "cash")
        .eq("settlement_status", "pending"),
      admin
        .from("user_profiles")
        .select("id, name")
        .eq("role", "technician")
        .eq("active", true)
        .order("name"),
    ]);

  const totalPending =
    ((pendingSum as { total: number }[] | null) ?? []).reduce(
      (s, o) => s + Number(o.total),
      0,
    );

  const techs = (technicians as { id: string; name: string }[] | null) ?? [];
  const month = currentMonthValue();

  return (
    <div className="p-6 space-y-4">
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
                <div className="flex-1">
                  <p className="text-base font-semibold text-zinc-900">
                    師傅待回繳
                  </p>
                  <p className="text-sm text-zinc-500">
                    {pendingCount ?? 0} 筆 · {formatNTD(totalPending)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-zinc-300" />
              </div>
            </CardBody>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-500" />
            計件薪資月報（按師傅）
          </CardTitle>
        </CardHeader>
        <CardBody>
          {techs.length === 0 ? (
            <p className="text-sm text-zinc-500">尚無師傅資料</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {techs.map((t) => (
                <Link
                  key={t.id}
                  href={`/payroll/${t.id}?month=${month}`}
                  className="rounded-xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold text-zinc-900">
                      {t.name}
                    </p>
                    <ChevronRight className="h-5 w-5 text-zinc-300" />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    本月（{month}）計件明細
                  </p>
                </Link>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-zinc-400">
            重現「2026年五月份」Excel 版型，可匯出 .xlsx
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
