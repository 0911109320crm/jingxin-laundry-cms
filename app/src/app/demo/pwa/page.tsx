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

  let previewName: string | null = null;
  if (tech) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data } = await createAdminClient()
      .from("user_profiles")
      .select("name")
      .eq("id", tech)
      .maybeSingle();
    previewName = (data as { name: string } | null)?.name ?? null;
  }

  // 預覽指定師傅 → iframe 載入 /staff?as=<id>（越權防護在 /staff 內以登入者角色把關）
  const previewSrc = tech ? `/staff?as=${encodeURIComponent(tech)}` : "/staff";

  return (
    <PhoneFrame
      userName={me.profile.name}
      previewSrc={previewSrc}
      previewName={previewName}
    />
  );
}
