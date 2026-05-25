import Link from "next/link";
import { CalendarRange, PackageSearch, Wallet, Home } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { logoutAction } from "@/app/login/actions";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // owner-only — manager / technician 會被 requireRole 導去 /unauthorized
  const user = await requireRole(["owner"]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100">
      <header
        className="sticky top-0 z-10 border-b border-zinc-200 bg-white"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-bold text-zinc-900">淨新清潔工坊</p>
            <p className="text-xs text-zinc-500">老闆娘 · {user.profile.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              桌機版
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                登出
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto pb-24">{children}</main>
      <nav
        className="fixed bottom-0 left-0 right-0 z-10 grid grid-cols-4 border-t border-zinc-200 bg-white"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ManagerTab href="/manager" icon={Home} label="主選單" />
        <ManagerTab
          href="/manager/schedule"
          icon={CalendarRange}
          label="一周排案"
        />
        <ManagerTab
          href="/manager/pending"
          icon={PackageSearch}
          label="待派案"
        />
        <ManagerTab
          href="/manager/settle-today"
          icon={Wallet}
          label="今日回繳"
        />
      </nav>
    </div>
  );
}

function ManagerTab({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Home;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 py-2 text-[11px] text-zinc-600 hover:text-brand-700"
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
