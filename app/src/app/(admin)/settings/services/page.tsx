import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ServiceRow, type Service } from "./ServiceRow";
import { NewServiceForm } from "./NewServiceForm";
import { SERVICE_CATEGORIES, type ServiceCategoryKey } from "./categories";

export default async function ServicesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; showInactive?: string }>;
}) {
  await requireRole(["owner", "manager"]);
  const sp = await searchParams;
  const activeCategory =
    (SERVICE_CATEGORIES.find((c) => c.key === sp.category)?.key as
      | ServiceCategoryKey
      | undefined) ?? null;
  const showInactive = sp.showInactive === "1";

  const supabase = await createClient();
  let q = supabase
    .from("service_items")
    .select("id, code, name, default_price, category, sort_order, active")
    .order("sort_order");
  if (activeCategory) q = q.eq("category", activeCategory);
  if (!showInactive) q = q.eq("active", true);

  const { data } = await q;
  const items = (data as Service[] | null) ?? [];

  const baseUrl = "/settings/services";
  const buildHref = (cat: string | null, includeInactive = showInactive) => {
    const params = new URLSearchParams();
    if (cat) params.set("category", cat);
    if (includeInactive) params.set("showInactive", "1");
    const s = params.toString();
    return s ? `${baseUrl}?${s}` : baseUrl;
  };

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">服務項目</h1>
        <p className="text-sm text-zinc-500">
          代碼（貼紙）+ 名稱 + 預設價。預設價是建立訂單時的初值，可在訂單頁調整。
          項目共 {items.length} 項（顯示中），完整清單請依分類分頁查看。
        </p>
      </header>

      <nav className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3">
        <a
          href={buildHref(null)}
          className={
            activeCategory === null
              ? "rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
              : "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          }
        >
          全部
        </a>
        {SERVICE_CATEGORIES.map((c) => {
          const isActive = c.key === activeCategory;
          return (
            <a
              key={c.key}
              href={buildHref(c.key)}
              className={
                isActive
                  ? "rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              }
            >
              {c.label}
            </a>
          );
        })}
        <a
          href={buildHref(activeCategory, !showInactive)}
          className="ml-auto rounded-lg px-3 py-1.5 text-xs text-zinc-500 underline-offset-2 hover:underline"
        >
          {showInactive ? "[隱藏停用]" : "[顯示停用]"}
        </a>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>新增項目</CardTitle>
        </CardHeader>
        <CardBody>
          <NewServiceForm defaultCategory={activeCategory ?? undefined} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>項目清單（{items.length}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <div className="grid grid-cols-[110px_1fr_100px_140px_80px_70px_auto] gap-2 border-b border-zinc-200 bg-zinc-50 px-5 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <div>代碼</div>
            <div>名稱</div>
            <div>預設價</div>
            <div>分類</div>
            <div>排序</div>
            <div>狀態</div>
            <div></div>
          </div>
          {items.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">尚無資料</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {items.map((s) => (
                <li key={s.id}>
                  <ServiceRow service={s} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
