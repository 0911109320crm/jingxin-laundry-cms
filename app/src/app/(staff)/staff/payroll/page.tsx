import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { fetchPayroll } from "@/lib/payroll";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatNTD } from "@/lib/utils";

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

export default async function StaffPayroll({
  searchParams,
}: {
  searchParams: SP;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const sp = await searchParams;
  const month = sp.month ?? currentMonth();
  const data = await fetchPayroll(me.id, month);

  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <div className="p-4 space-y-4">
      <header className="space-y-2">
        <h1 className="text-xl font-bold text-zinc-900">我的薪資</h1>
        <div className="flex items-center gap-1">
          <Link
            href={`/staff/payroll?month=${prev}`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            ←
          </Link>
          <span className="flex-1 rounded bg-zinc-900 px-3 py-1.5 text-center text-sm font-medium text-white">
            {month}
          </span>
          <Link
            href={`/staff/payroll?month=${next}`}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            →
          </Link>
        </div>
      </header>

      {!data ? (
        <Card>
          <CardBody>
            <p className="text-sm text-zinc-500">無資料</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardBody className="space-y-1 text-center">
              <p className="text-xs text-zinc-500">本月應收計件</p>
              <p className="text-3xl font-bold text-brand-700 font-mono">
                {formatNTD(data.monthTotal)}
              </p>
              <p className="text-xs text-zinc-500">
                共 {data.totalItems} 件
                {data.monthAddon > 0 && ` · 加價 ${formatNTD(data.monthAddon)}`}
                {data.monthDiscount > 0 && ` · 折扣 ${formatNTD(data.monthDiscount)}`}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>每日明細</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <ul className="divide-y divide-zinc-200">
                {data.rows
                  .filter((row) => row.items.length > 0)
                  .map((row) => {
                    const dayNet =
                      row.dayTotal + row.addonTotal - row.discountTotal;
                    return (
                      <li key={row.day} className="px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            {row.date.slice(5)}（{row.day}日）
                          </span>
                          <span className="font-mono font-semibold text-zinc-900">
                            {formatNTD(dayNet)}
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {row.items.map((it) => (
                            <li
                              key={it.id}
                              className="flex items-center justify-between text-xs text-zinc-600"
                            >
                              <span>
                                {it.customer_name}
                                {it.service_code && ` · ${it.service_code}`}
                                {it.tag && ` (${it.tag})`}
                              </span>
                              <span className="font-mono">
                                {formatNTD(it.unit_price)}
                              </span>
                            </li>
                          ))}
                          {row.addonTotal > 0 && (
                            <li className="flex items-center justify-between text-xs text-orange-600">
                              <span>加價</span>
                              <span className="font-mono">
                                +{formatNTD(row.addonTotal)}
                              </span>
                            </li>
                          )}
                          {row.discountTotal > 0 && (
                            <li className="flex items-center justify-between text-xs text-blue-600">
                              <span>折扣</span>
                              <span className="font-mono">
                                -{formatNTD(row.discountTotal)}
                              </span>
                            </li>
                          )}
                        </ul>
                      </li>
                    );
                  })}
              </ul>
              {data.rows.every((row) => row.items.length === 0) && (
                <p className="p-5 text-sm text-zinc-500">本月尚無接案</p>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
