import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { PhoneFrame } from "./PhoneFrame";

export const metadata = {
  title: "師傅 PWA 示範 — 淨新清潔工坊",
};

export default async function DemoPWAPage({
  searchParams,
}: {
  searchParams: Promise<{ tech?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login?next=/demo/pwa");

  const sp = await searchParams;
  const tech = typeof sp.tech === "string" ? sp.tech : null;

  // 師傅清單（頁面上的切換列用，因為這頁沒有後台側邊欄）
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: techRows } = await admin
    .from("user_profiles")
    .select("id, name")
    .eq("role", "technician")
    .eq("active", true)
    .order("name");
  const technicians = (techRows as { id: string; name: string }[] | null) ?? [];
  const previewName =
    (tech && technicians.find((t) => t.id === tech)?.name) || null;

  // 預覽指定師傅 → iframe 載入 /staff?as=<id>（越權防護在 /staff 內以登入者角色把關）
  const previewSrc = tech ? `/staff?as=${encodeURIComponent(tech)}` : "/staff";

  return (
    <PhoneFrame
      userName={me.profile.name}
      previewSrc={previewSrc}
      previewName={previewName}
      technicians={technicians}
      activeTechId={tech}
    />
  );
}
