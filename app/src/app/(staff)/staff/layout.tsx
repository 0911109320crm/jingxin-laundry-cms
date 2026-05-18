import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { logoutAction } from "@/app/login/actions";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-bold text-zinc-900">淨新洗衣</p>
            <p className="text-xs text-zinc-500">師傅 · {user.profile.name}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              登出
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 overflow-auto pb-20">{children}</main>
    </div>
  );
}
