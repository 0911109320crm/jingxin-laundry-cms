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
  // 預覽工具僅供老闆娘/管理者；師傅一律不得進入(否則可看到全師傅切換列＝越權)。
  // can_view_all 只授權「看全部排班」，不含預覽他人金額/PII。
  if (me.profile.role === "technician") {
    redirect("/staff");
  }

  const sp = await searchParams;
  const tech = typeof sp.tech === "string" ? sp.tech : null;

  // 查預覽中師傅的名字（桌機展示側欄顯示用）。切換師傅改由後台側邊欄次選單／框內 /staff 內建切換器。
  let previewName: string | null = null;
  if (tech) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data: techRow } = await createAdminClient()
      .from("user_profiles")
      .select("name")
      .eq("id", tech)
      .maybeSingle();
    previewName = (techRow as { name: string } | null)?.name ?? null;
  }

  // 預覽指定師傅 → iframe 載入 /staff?as=<id>（越權防護在 /staff 內以登入者角色把關）
  // embed=1：告訴被嵌入的 /staff 隱藏「查看所有排班/預覽各師傅」入口卡，
  //          否則 iframe 內又出現「預覽各師傅頁面」→ 點下去巢狀載入 /demo/pwa → 切換列重複出現。
  const previewSrc = tech
    ? `/staff?as=${encodeURIComponent(tech)}&embed=1`
    : "/staff?embed=1";

  return (
    <PhoneFrame
      userName={me.profile.name}
      previewSrc={previewSrc}
      previewName={previewName}
    />
  );
}
