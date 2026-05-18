"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  CalendarDays,
  BellRing,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";

type NavItem = { href: string; label: string; icon: LucideIcon };

const items: NavItem[] = [
  { href: "/dashboard", label: "儀表板", icon: LayoutDashboard },
  { href: "/customers", label: "顧客", icon: Users },
  { href: "/orders", label: "訂單", icon: ClipboardList },
  { href: "/calendar", label: "月曆排案", icon: CalendarDays },
  { href: "/reminders", label: "即將到期", icon: BellRing },
  { href: "/reports", label: "營業報表", icon: BarChart3 },
  { href: "/payroll", label: "師傅薪資", icon: Wallet },
  { href: "/settings", label: "系統設定", icon: Settings },
];

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 py-4">
        <p className="text-sm font-bold text-zinc-900">淨新洗衣</p>
        <p className="text-xs text-zinc-500">管理系統</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-zinc-700 hover:bg-zinc-100",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 px-3 py-3 space-y-1">
        <div className="px-3 py-1 text-xs text-zinc-500">登入身分</div>
        <div className="px-3 pb-2 text-sm font-medium text-zinc-900">
          {userName}
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            <LogOut className="h-4 w-4" />
            登出
          </button>
        </form>
      </div>
    </aside>
  );
}
