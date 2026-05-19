import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { fetchPayroll } from "@/lib/payroll";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatNTD } from "@/lib/utils";

type Params = Promise<{ user_id: string }>;
type SP = Promise<{ month?: string }>;

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function TechnicianPayrollPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SP;
}) {
  await requireRole(["owner", "manager"]);
  const { user_id } = await params;
  const sp = await searchParams;
  const month = sp.month ?? currentMonth();
  const data = await fetchPayroll(user_id, month);
  if (!data) notFound();

  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/payroll"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ChevronLeft className="h-4 w-4" /> 回師傅薪資
        </Link>
        <a
          href={`/api/payroll/export?user=${user_id}&month=${month}`}
          target="_blank"
        >
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" /> 匯出 Excel
          </Button>
        </a>
      </div>

      <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {data.technician.name} · {data.year} 年 {data.month} 月計件明細
          </h1>
          <p className="text-sm text-zinc-500">
            本月接案 {data.totalItems} 件 · 應收 {formatNTD(data.monthTotal)}
            （加價 {formatNTD(data.monthAddon)}、折扣 {formatNTD(data.monthDiscount)}）
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/payroll/${user_id}?month=${prev}`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            ← {prev}
          </Link>
          <span className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">
            {month}
          </span>
          <Link
            href={`/payroll/${user_id}?month=${next}`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            {next} →
          </Link>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>每日明細</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="border border-zinc-200 px-2 py-2 text-left">日期</th>
                  <th className="border border-zinc-200 px-2 py-2 text-right">當日應收</th>
                  <th className="border border-zinc-200 px-2 py-2 text-left" colSpan={4}>第一台</th>
                  <th className="border border-zinc-200 px-2 py-2 text-left" colSpan={4}>第二台</th>
                  <th className="border border-zinc-200 px-2 py-2 text-left" colSpan={4}>第三台</th>
                  <th className="border border-zinc-200 px-2 py-2 text-left" colSpan={4}>第四台</th>
                  <th className="border border-zinc-200 px-2 py-2 text-right">加大</th>
                  <th className="border border-zinc-200 px-2 py-2 text-right">其他</th>
                  <th className="border border-zinc-200 px-2 py-2 text-right">折扣</th>
                  <th className="border border-zinc-200 px-2 py-2 text-center">匯款</th>
                </tr>
                <tr className="text-[10px] text-zinc-500">
                  <th className="border border-zinc-200 px-2 py-1"></th>
                  <th className="border border-zinc-200 px-2 py-1"></th>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <React.Fragment key={i}>
                      <th className="border border-zinc-200 px-2 py-1">代號</th>
                      <th className="border border-zinc-200 px-2 py-1">金額</th>
                      <th className="border border-zinc-200 px-2 py-1">姓名</th>
                      <th className="border border-zinc-200 px-2 py-1">編號</th>
                    </React.Fragment>
                  ))}
                  <th className="border border-zinc-200 px-2 py-1"></th>
                  <th className="border border-zinc-200 px-2 py-1"></th>
                  <th className="border border-zinc-200 px-2 py-1"></th>
                  <th className="border border-zinc-200 px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const isEmpty = row.items.length === 0;
                  const dayNet = row.dayTotal + row.addonTotal - row.discountTotal;
                  return (
                    <tr key={row.day} className={isEmpty ? "text-zinc-300" : ""}>
                      <td className="border border-zinc-200 px-2 py-1.5 text-left font-medium">
                        {row.day}
                      </td>
                      <td className="border border-zinc-200 px-2 py-1.5 text-right font-mono">
                        {isEmpty ? "" : dayNet.toLocaleString()}
                      </td>
                      {Array.from({ length: 4 }).map((_, i) => {
                        const it = row.items[i];
                        if (!it) {
                          return (
                            <>
                              <td key={`et-${row.day}-${i}`} className="border border-zinc-200 px-2 py-1.5"></td>
                              <td key={`ea-${row.day}-${i}`} className="border border-zinc-200 px-2 py-1.5"></td>
                              <td key={`en-${row.day}-${i}`} className="border border-zinc-200 px-2 py-1.5"></td>
                              <td key={`ec-${row.day}-${i}`} className="border border-zinc-200 px-2 py-1.5"></td>
                            </>
                          );
                        }
                        return (
                          <>
                            <td key={`t-${it.id}`} className="border border-zinc-200 px-2 py-1.5">
                              {it.tag ?? ""}
                            </td>
                            <td key={`a-${it.id}`} className="border border-zinc-200 px-2 py-1.5 text-right font-mono">
                              {it.unit_price.toLocaleString()}
                            </td>
                            <td key={`n-${it.id}`} className="border border-zinc-200 px-2 py-1.5">
                              {it.customer_name}
                            </td>
                            <td key={`c-${it.id}`} className="border border-zinc-200 px-2 py-1.5 font-mono text-zinc-500">
                              {it.customer_code}
                            </td>
                          </>
                        );
                      })}
                      <td className="border border-zinc-200 px-2 py-1.5 text-right">
                        {row.addonTotal > 0 ? row.addonTotal.toLocaleString() : ""}
                      </td>
                      <td className="border border-zinc-200 px-2 py-1.5 text-right">
                        {/* "其他" 在原 Excel 中是另一種加價，這裡併入加大欄；保留欄位但目前留空 */}
                      </td>
                      <td className="border border-zinc-200 px-2 py-1.5 text-right">
                        {row.discountTotal > 0 ? row.discountTotal.toLocaleString() : ""}
                      </td>
                      <td className="border border-zinc-200 px-2 py-1.5 text-center text-amber-700">
                        {row.transferredCount > 0 ? "✓" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-zinc-100 font-semibold">
                <tr>
                  <td className="border border-zinc-200 px-2 py-2">總計</td>
                  <td className="border border-zinc-200 px-2 py-2 text-right font-mono">
                    {data.monthTotal.toLocaleString()}
                  </td>
                  <td colSpan={16} className="border border-zinc-200 px-2 py-2 text-right text-zinc-500">
                    本月應收（含加價減折扣）
                  </td>
                  <td className="border border-zinc-200 px-2 py-2 text-right font-mono">
                    {data.monthAddon > 0 ? data.monthAddon.toLocaleString() : ""}
                  </td>
                  <td className="border border-zinc-200 px-2 py-2"></td>
                  <td className="border border-zinc-200 px-2 py-2 text-right font-mono">
                    {data.monthDiscount > 0 ? data.monthDiscount.toLocaleString() : ""}
                  </td>
                  <td className="border border-zinc-200 px-2 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
