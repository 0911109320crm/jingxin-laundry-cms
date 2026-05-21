import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ServiceTagRow, type ServiceTag } from "./ServiceTagRow";
import { NewServiceTagForm } from "./NewServiceTagForm";
import { TAG_CATEGORIES, type TagCategoryKey } from "./categories";

export default async function ServiceTagsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireRole(["owner", "manager"]);
  const sp = await searchParams;
  const activeCategory: TagCategoryKey =
    (TAG_CATEGORIES.find((c) => c.key === sp.category)?.key as TagCategoryKey) ??
    TAG_CATEGORIES[0].key;

  const supabase = await createClient();
  const { data } = await supabase
    .from("service_tag_presets")
    .select("id, category, label, sort_order, active")
    .eq("category", activeCategory)
    .order("sort_order");

  const tags = (data as ServiceTag[] | null) ?? [];

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">師傅快速備註標籤</h1>
        <p className="text-sm text-zinc-500">
          師傅在 PWA「標記完成」對話框，會自動依機型顯示對應分組的標籤。停用的標籤不會出現在勾選清單，但舊訂單記錄的標籤仍保留。
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
        {TAG_CATEGORIES.map((c) => {
          const isActive = c.key === activeCategory;
          return (
            <a
              key={c.key}
              href={`/settings/service-tags?category=${c.key}`}
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
          <CardTitle>
            新增標籤（{TAG_CATEGORIES.find((c) => c.key === activeCategory)?.label}）
          </CardTitle>
        </CardHeader>
        <CardBody>
          <NewServiceTagForm category={activeCategory} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>標籤清單（{tags.length}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {tags.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">尚無資料</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {tags.map((t) => (
                <li key={t.id}>
                  <ServiceTagRow tag={t} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
