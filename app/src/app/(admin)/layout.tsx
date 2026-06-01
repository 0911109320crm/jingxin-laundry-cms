import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { getCurrentUser } from "@/lib/dal";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile.role === "technician") redirect("/staff");

  const readonly = Boolean(user.profile.readonly);

  // 師傅清單（給側邊欄「師傅 PWA」次選單預覽用）；用 admin client 避免 RLS 漏讀
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data: techRows } = await createAdminClient()
    .from("user_profiles")
    .select("id, name")
    .eq("role", "technician")
    .eq("active", true)
    .order("name");
  const technicians = (techRows as { id: string; name: string }[] | null) ?? [];

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <Sidebar userName={user.profile.name} technicians={technicians} />
      <main className="flex-1 overflow-auto bg-zinc-50">
        {readonly && (
          <div className="sticky top-0 z-20 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
            🔒 查帳唯讀模式 — 只顯示 2022-08-11（公司成立日）後的顧客與訂單，無法新增或修改任何資料
          </div>
        )}
        {children}
      </main>
      {!readonly && <GlobalSearch />}
    </div>
  );
}
