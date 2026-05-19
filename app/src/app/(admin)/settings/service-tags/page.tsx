import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ServiceTagRow, type ServiceTag } from "./ServiceTagRow";
import { NewServiceTagForm } from "./NewServiceTagForm";

export default async function ServiceTagsSettingsPage() {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_tag_presets")
    .select("id, label, sort_order, active")
    .order("sort_order");

  const tags = (data as ServiceTag[] | null) ?? [];

  return (
    <div className="p-8 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">師傅快速備註標籤</h1>
        <p className="text-sm text-zinc-500">
          這些標籤會出現在師傅 PWA「標記完成」對話框，供師傅快速勾選。停用的標籤不會出現在勾選清單，但舊訂單已記錄的標籤仍保留。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>新增標籤</CardTitle>
        </CardHeader>
        <CardBody>
          <NewServiceTagForm />
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
