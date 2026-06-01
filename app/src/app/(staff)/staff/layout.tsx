import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Star } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { logoutAction } from "@/app/login/actions";
import { PWAInstallButton } from "@/components/PWAInstallButton";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-zinc-100">
      <header
        className="sticky top-0 z-10 border-b border-zinc-200 bg-white"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-zinc-900">淨新清潔工坊</p>
            <p className="truncate text-xs text-zinc-500">師傅 · {user.profile.name}</p>
          </div>
          <form action={logoutAction} className="shrink-0">
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              登出
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 overflow-x-hidden overflow-y-auto pb-24">{children}</main>
      <PWAInstallButton />
      <nav
        className="fixed bottom-0 left-0 right-0 z-10 grid grid-cols-2 border-t border-zinc-200 bg-white"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Link
          href="/staff"
          className="flex flex-col items-center gap-1 py-2 text-xs text-zinc-600 hover:text-brand-700"
        >
          <CalendarDays className="h-5 w-5" />
          今日案件
        </Link>
        <Link
          href="/staff/scores"
          className="flex flex-col items-center gap-1 py-2 text-xs text-zinc-600 hover:text-brand-700"
        >
          <Star className="h-5 w-5" />
          我的積分
        </Link>
      </nav>
    </div>
  );
}
