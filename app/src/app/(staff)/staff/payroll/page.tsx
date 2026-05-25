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

  // 師傅只看「完成幾件 + 總服務金額」，不看抽成 / 加減項 / 獎金
  const monthServiceTotal =
    data?.rows.reduce(
      (s, r) => s + r.items.reduce((ss, it) => ss + it.subtotal, 0),
      0,
    ) ?? 0;

  return (
    <div className="p-4 space-y-4">
      <header className="space-y-2">
        <h1 className="text-xl font-bold text-zinc-900">我的接案紀錄</h1>
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
              <p className="text-xs text-zinc-500">本月完成</p>
              <p className="text-3xl font-bold text-brand-700 font-mono">
                {data.totalItems} <span className="text-xl">件</span>
              </p>
              <p className="text-xs text-zinc-500">
                服務總額 {formatNTD(monthServiceTotal)}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>每日接案明細</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <ul className="divide-y divide-zinc-200">
                {data.rows
                  .filter((row) => row.items.length > 0)
                  .map((row) => (
                    <li key={row.day} className="px-4 py-3 space-y-2">
                      <div className="text-sm font-semibold text-zinc-700">
                        {row.date.slice(5)}（{row.items.length} 件）
                      </div>
                      <ul className="space-y-1.5">
                        {row.items.map((it) => (
                          <li
                            key={it.id}
                            className="flex items-start justify-between gap-2 text-xs text-zinc-600"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-zinc-500">
                                {it.order_code}
                              </p>
                              <p className="text-zinc-700">
                                {it.service_name ?? "—"}
                                {it.tag && (
                                  <span className="ml-1 text-zinc-500">
                                    ({it.tag})
                                  </span>
                                )}
                              </p>
                              <p className="text-zinc-400">{it.customer_name}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
              </ul>
              {data.rows.every((row) => row.items.length === 0) && (
                <p className="p-5 text-sm text-zinc-500">本月尚無接案</p>
              )}
            </CardBody>
          </Card>

          <p className="text-center text-xs text-zinc-400">
            薪資金額由老闆娘核算後發放
          </p>
        </>
      )}
    </div>
  );
}
