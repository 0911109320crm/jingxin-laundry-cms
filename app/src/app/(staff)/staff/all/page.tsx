import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin, CalendarDays, Eye } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardBody } from "@/components/ui/Card";
import { techHex } from "@/lib/tech-colors";

const TW_DATE_FMT = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Taipei",
});
const TW_TIME_FMT = new Intl.DateTimeFormat("zh-TW", {
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei",
});
const twDateKey = (iso: string) => TW_DATE_FMT.format(new Date(iso));
function dateHeader(dateKey: string) {
  const today = TW_DATE_FMT.format(new Date());
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
  const main = new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Taipei" })
    .format(new Date(`${dateKey}T12:00:00+08:00`));
  return { main, isToday: dateKey === today, isTomorrow: dateKey === TW_DATE_FMT.format(tmr) };
}

type Tech = { id: string; name: string };
type Row = {
  id: string;
  scheduled_at: string;
  status: string;
  customer: { name: string } | null;
  address: { county: string; district: string } | null;
  items: { technician_id: string | null; service: { name: string } | null }[];
};

export default async function StaffAllSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ tech?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login?next=/staff/all");
  // 僅限有「檢視全部」權限的師傅（身為老闆的師傅）；其餘退回自己的排班
  if (!me.profile.can_view_all) redirect("/staff");

  const sp = await searchParams;
  const admin = createAdminClient(); // 伺服器端、旗標把關後才用；不動 RLS

  const { data: techsRaw } = await admin
    .from("user_profiles")
    .select("id, name")
    .eq("active", true)
    .eq("role", "technician")
    .order("name");
  const techs = (techsRaw as Tech[] | null) ?? [];
  if (techs.length === 0) {
    return <div className="p-4 text-sm text-zinc-500">尚無師傅資料</div>;
  }

  const selected =
    sp.tech && techs.some((t) => t.id === sp.tech) ? sp.tech : techs[0].id;
  const idx = techs.findIndex((t) => t.id === selected);
  const prev = techs[(idx - 1 + techs.length) % techs.length];
  const next = techs[(idx + 1) % techs.length];
  const selectedName = techs[idx]?.name ?? "";

  // 近期(前7天~未來)非取消、已排程的單；只取排班檢視需要的最小欄位
  const startWindow = new Date();
  startWindow.setDate(startWindow.getDate() - 7);
  const { data: ordersRaw } = await admin
    .from("orders")
    .select(
      `id, scheduled_at, status,
       customer:customers(name),
       address:customer_addresses(county, district),
       items:order_items(technician_id, service:service_items(name))`,
    )
    .not("scheduled_at", "is", null)
    .neq("status", "cancelled")
    .gte("scheduled_at", startWindow.toISOString())
    .order("scheduled_at");

  const orders = ((ordersRaw as Row[] | null) ?? []).filter((o) =>
    (o.items ?? []).some((it) => it.technician_id === selected),
  );

  const groups: { dateKey: string; orders: Row[] }[] = [];
  for (const o of orders) {
    const key = twDateKey(o.scheduled_at);
    const last = groups[groups.length - 1];
    if (last && last.dateKey === key) last.orders.push(o);
    else groups.push({ dateKey: key, orders: [o] });
  }

  const dotHex = techHex(selectedName) ?? "#6b7280";

  return (
    <div className="space-y-4 p-4">
      {/* 唯讀標示 */}
      <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
        <Eye className="h-4 w-4 shrink-0" />
        唯讀檢視全部師傅排班（看別人的單不能操作）
      </div>

      {/* 師傅切換：左右箭頭 + 目前師傅 */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/staff/all?tech=${prev.id}`}
          className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-600 active:bg-zinc-100"
          aria-label="上一位師傅"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: dotHex }} />
          <span className="truncate text-base font-bold text-zinc-900">{selectedName}</span>
        </div>
        <Link
          href={`/staff/all?tech=${next.id}`}
          className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-600 active:bg-zinc-100"
          aria-label="下一位師傅"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {/* 師傅快捷 chips */}
      <div className="flex flex-wrap gap-1.5">
        {techs.map((t) => {
          const active = t.id === selected;
          const hex = techHex(t.name) ?? "#6b7280";
          return (
            <Link
              key={t.id}
              href={`/staff/all?tech=${t.id}`}
              style={active ? { backgroundColor: hex } : undefined}
              className={
                active
                  ? "rounded-full px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-600"
              }
            >
              {t.name}
            </Link>
          );
        })}
      </div>

      {/* 排班列表（唯讀，無操作） */}
      {groups.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-12">
            <CalendarDays className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">這位師傅近期沒有案件</p>
            <p className="text-xs text-zinc-400">（顯示 7 天前到未來）</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map(({ dateKey, orders: dayOrders }) => {
            const { main, isToday, isTomorrow } = dateHeader(dateKey);
            return (
              <section key={dateKey} className="space-y-2">
                <div className="sticky top-0 z-10 -mx-4 border-y border-zinc-200 bg-zinc-100 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-800">{main}</span>
                    {isToday && (
                      <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-medium text-white">今天</span>
                    )}
                    {isTomorrow && (
                      <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white">明天</span>
                    )}
                    <span className="ml-auto text-xs text-zinc-500">{dayOrders.length} 件</span>
                  </div>
                </div>
                {dayOrders.map((o) => {
                  const services = Array.from(
                    new Set((o.items ?? []).map((it) => it.service?.name).filter(Boolean) as string[]),
                  ).join("、");
                  return (
                    <Card key={o.id}>
                      <CardBody className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-brand-700">
                            {TW_TIME_FMT.format(new Date(o.scheduled_at))}
                          </span>
                          <span className="font-medium text-zinc-900">
                            {o.customer?.name ?? "—"}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-600">{services || "未填項目"}</p>
                        <p className="flex items-center gap-1 text-xs text-zinc-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {o.address ? `${o.address.county}${o.address.district}` : "—"}
                        </p>
                      </CardBody>
                    </Card>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
