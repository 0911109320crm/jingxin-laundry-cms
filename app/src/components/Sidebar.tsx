"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  CalendarDays,
  CalendarCheck,
  CalendarClock,
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
  ChevronDown,
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
  { href: "/agenda", label: "我的行事曆", icon: CalendarClock },
  { href: "/reminders", label: "即將到期", icon: BellRing },
  { href: "/reports", label: "營業報表", icon: BarChart3 },
  { href: "/payroll", label: "師傅薪資", icon: Wallet },
  { href: "/scores", label: "促銷積分排行", icon: Star },
  { href: "/demo/manager", label: "老闆娘 PWA", icon: Smartphone },
  // 師傅 PWA 改成可展開次選單（見下方 StaffPwaMenu），不放在這個清單
  { href: "/settings", label: "系統設定", icon: Settings },
];

const itemClass = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    active ? "bg-brand-50 text-brand-700" : "text-zinc-700 hover:bg-zinc-100",
  );

export function Sidebar({
  userName,
  technicians,
}: {
  userName: string;
  technicians: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const onStaffPwa = pathname === "/demo/pwa";
  const [techOpen, setTechOpen] = useState(onStaffPwa);
  const activeTech = onStaffPwa ? searchParams.get("tech") : null;
  const closeDrawer = () => setOpen(false);

  const NavList = (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        const node = (
          <Link
            key={href}
            href={href}
            onClick={closeDrawer}
            className={itemClass(active)}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
        // 在「老闆娘 PWA」之後插入「師傅 PWA」次選單
        if (href === "/demo/manager") {
          return (
            <div key="group-pwa" className="space-y-1">
              {node}
              <div>
                <button
                  type="button"
                  onClick={() => setTechOpen((v) => !v)}
                  className={cn(itemClass(onStaffPwa), "w-full")}
                  aria-expanded={techOpen}
                >
                  <HardHat className="h-4 w-4" />
                  <span className="flex-1 text-left">師傅 PWA</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-zinc-400 transition-transform",
                      techOpen && "rotate-180",
                    )}
                  />
                </button>
                {techOpen && (
                  <div className="mt-1 ml-3 space-y-0.5 border-l border-zinc-200 pl-2">
                    {technicians.length === 0 ? (
                      <p className="px-3 py-1.5 text-xs text-zinc-400">
                        尚無師傅
                      </p>
                    ) : (
                      technicians.map((t) => (
                        <Link
                          key={t.id}
                          href={`/demo/pwa?tech=${t.id}`}
                          onClick={closeDrawer}
                          className={cn(
                            "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                            activeTech === t.id
                              ? "bg-brand-50 font-medium text-brand-700"
                              : "text-zinc-600 hover:bg-zinc-100",
                          )}
                        >
                          {t.name}
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        }
        return node;
      })}
    </nav>
  );

  function openSearch() {
    setOpen(false); // 若是從手機抽屜點的，先關抽屜再開搜尋
    window.dispatchEvent(new CustomEvent("open-global-search"));
  }

  const SearchChip = (
    <div className="px-3 pb-2">
      <button
        type="button"
        onClick={openSearch}
        className="flex w-full items-center gap-2 rounded-lg border border-brand-400 bg-brand-50 px-3 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition-colors hover:bg-brand-100"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">搜尋客戶 / 訂單</span>
        <kbd className="hidden rounded border border-brand-200 bg-white px-1 py-0.5 text-[10px] font-mono text-brand-500 lg:block">
          ⌘K
        </kbd>
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
        <div className="flex min-w-0 items-center gap-2">
          <Image src="/logo.png" alt="淨新" width={36} height={36} className="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-zinc-900">淨新清潔工坊</p>
            <p className="truncate text-xs text-zinc-500">{userName}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={openSearch}
            className="flex items-center gap-1 rounded-lg border border-brand-400 bg-brand-50 px-2.5 py-2 text-sm font-semibold text-brand-700 active:bg-brand-100"
            aria-label="搜尋"
          >
            <Search className="h-4 w-4" />
            搜尋
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-zinc-700 hover:bg-zinc-100"
            aria-label="開啟選單"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
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
              <div className="flex items-center gap-2">
                <Image src="/logo.png" alt="淨新" width={40} height={40} className="h-10 w-10 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-zinc-900">淨新清潔工坊</p>
                  <p className="text-xs text-zinc-500">管理系統</p>
                </div>
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
            <div className="pt-2">{SearchChip}</div>
            {NavList}
            {Footer}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 border-b border-zinc-200 px-5 py-4">
          <Image src="/logo.png" alt="淨新" width={44} height={44} className="h-11 w-11 shrink-0" />
          <div>
            <p className="text-sm font-bold text-zinc-900">淨新清潔工坊</p>
            <p className="text-xs text-zinc-500">管理系統</p>
          </div>
        </div>
        {NavList}
        {SearchChip}
        {Footer}
      </aside>
    </>
  );
}
