import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { BrandRow, type Brand } from "./BrandRow";
import { NewBrandForm } from "./NewBrandForm";
import { CATEGORIES } from "./categories";

type CategoryKey = (typeof CATEGORIES)[number]["key"];

export default async function MachineBrandsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireRole(["owner", "manager"]);
  const sp = await searchParams;
  const activeCategory: CategoryKey =
    (CATEGORIES.find((c) => c.key === sp.category)?.key as CategoryKey) ??
    CATEGORIES[0].key;

  const supabase = await createClient();
  const { data } = await supabase
    .from("machine_brands")
    .select("id, category, name, sort_order, active")
    .eq("category", activeCategory)
    .order("sort_order");

  const brands = (data as Brand[] | null) ?? [];

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">機型品牌主檔</h1>
        <p className="text-sm text-zinc-500">
          師傅在 PWA 用下拉選單選品牌。停用的品牌新增訂單時不會顯示，但舊資料仍保留。
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
        {CATEGORIES.map((c) => {
          const isActive = c.key === activeCategory;
          return (
            <a
              key={c.key}
              href={`/settings/machine-brands?category=${c.key}`}
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
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>新增品牌（{CATEGORIES.find((c) => c.key === activeCategory)?.label}）</CardTitle>
        </CardHeader>
        <CardBody>
          <NewBrandForm category={activeCategory} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>品牌清單（{brands.length}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {brands.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">尚無資料</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {brands.map((b) => (
                <li key={b.id}>
                  <BrandRow brand={b} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
