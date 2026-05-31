"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  CalendarDays,
  CalendarCheck,
  BellRing,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Star,
  Smartphone,
  HardHat,
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
  { href: "/calendar/month", label: "排班月檢視", icon: CalendarCheck },
  { href: "/reminders", label: "即將到期", icon: BellRing },
  { href: "/reports", label: "營業報表", icon: BarChart3 },
  { href: "/payroll", label: "師傅薪資", icon: Wallet },
  { href: "/scores", label: "促銷積分排行", icon: Star },
  { href: "/manager", label: "老闆娘 PWA", icon: Smartphone },
  { href: "/staff", label: "師傅 PWA", icon: HardHat },
  { href: "/settings", label: "系統設定", icon: Settings },
];

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const NavList = (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
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
  );

  function openSearch() {
    window.dispatchEvent(new CustomEvent("open-global-search"));
  }

  const SearchChip = (
    <div className="px-3 pb-2">
      <button
        type="button"
        onClick={openSearch}
        className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">搜尋</span>
        <kbd className="rounded border border-zinc-200 bg-white px-1 py-0.5 text-[10px] font-mono">⌘K</kbd>
      </button>
    </div>
  );

  const Footer = (
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
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-3 lg:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-zinc-900">淨新清潔工坊</p>
          <p className="truncate text-xs text-zinc-500">{userName}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg p-2 text-zinc-700 hover:bg-zinc-100"
          aria-label="開啟選單"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-zinc-900">淨新清潔工坊</p>
                <p className="text-xs text-zinc-500">管理系統</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-zinc-700 hover:bg-zinc-100"
                aria-label="關閉選單"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {NavList}
            {Footer}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-200 bg-white lg:flex">
        <div className="border-b border-zinc-200 px-5 py-4">
          <p className="text-sm font-bold text-zinc-900">淨新清潔工坊</p>
          <p className="text-xs text-zinc-500">管理系統</p>
        </div>
        {NavList}
        {SearchChip}
        {Footer}
      </aside>
    </>
  );
}
