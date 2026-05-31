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

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <Sidebar userName={user.profile.name} />
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
