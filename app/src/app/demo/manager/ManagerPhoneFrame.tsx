"use client";

import { useEffect, useState } from "react";
import { LogOut, Home, CalendarRange, PackageSearch, Wallet } from "lucide-react";
import { useIsMobile } from "@/lib/use-is-mobile";

type Tab = {
  key: string;
  label: string;
  href: string;
  icon: typeof Home;
};

const TABS: Tab[] = [
  { key: "home", label: "主選單", href: "/manager", icon: Home },
  { key: "schedule", label: "一周排案", href: "/manager/schedule", icon: CalendarRange },
  { key: "pending", label: "待派案", href: "/manager/pending", icon: PackageSearch },
  { key: "settle", label: "今日回繳", href: "/manager/settle-today", icon: Wallet },
];

export function ManagerPhoneFrame({
  userName,
  role,
}: {
  userName: string;
  role: string;
}) {
  const [active, setActive] = useState<string>("home");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const timeLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const activeTab = TABS.find((t) => t.key === active) ?? TABS[0];

  const isMobile = useIsMobile();

  // 真手機：不套桌機展示外框，內容直接全螢幕（保留頂部分頁切換列）
  if (isMobile) {
    return (
      <div className="flex h-[100dvh] flex-col bg-zinc-900">
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-zinc-800 px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                active === t.key
                  ? "bg-brand-600 font-medium text-white"
                  : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <iframe
          key={activeTab.href}
          src={activeTab.href}
          className="w-full flex-1 border-0 bg-white"
          title="老闆娘 PWA"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-zinc-900 px-4 py-8 text-zinc-100 lg:flex-row lg:items-start lg:justify-center lg:gap-10">
      {/* Phone frame */}
      <div className="relative">
        <div
          className="relative bg-zinc-950 shadow-2xl ring-1 ring-zinc-800"
          style={{ width: 420, height: 880, borderRadius: 55, padding: 14 }}
        >
          <div className="absolute left-[-3px] top-[120px] h-10 w-[3px] rounded-l bg-zinc-700" />
          <div className="absolute left-[-3px] top-[180px] h-16 w-[3px] rounded-l bg-zinc-700" />
          <div className="absolute left-[-3px] top-[260px] h-16 w-[3px] rounded-l bg-zinc-700" />
          <div className="absolute right-[-3px] top-[200px] h-24 w-[3px] rounded-r bg-zinc-700" />

          <div
            className="relative overflow-hidden bg-white"
            style={{ width: 392, height: 852, borderRadius: 42 }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-11 items-center justify-between px-7 text-xs font-semibold text-zinc-900">
              <span className="font-mono">{timeLabel}</span>
              <span className="flex items-center gap-1">
                <span>📶</span>
                <span>📡</span>
                <span>🔋</span>
              </span>
            </div>
            <div className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-7 w-32 -translate-x-1/2 rounded-full bg-black" />

            <iframe
              key={activeTab.href}
              src={activeTab.href}
              className="absolute inset-x-0 bottom-0 w-full border-0"
              style={{ top: 44, height: "calc(100% - 44px)" }}
              title={`老闆娘 PWA 預覽 - ${activeTab.label}`}
            />
          </div>
        </div>
      </div>

      <aside className="mt-6 w-full max-w-sm space-y-4 lg:mt-0">
        <div>
          <h1 className="text-xl font-bold text-white">老闆娘 PWA 示範</h1>
          <p className="mt-1 text-sm text-zinc-400">
            以「{userName}」（{role}）身份顯示
            {role !== "owner" && (
              <span className="ml-1 rounded bg-red-900/50 px-1.5 py-0.5 text-[11px] text-red-200">
                非 owner 將被導向 /unauthorized
              </span>
            )}
          </p>
        </div>

        {/* Page switcher */}
        <div className="grid grid-cols-2 gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <ol className="space-y-3 text-sm text-zinc-200">
          <li className="rounded-lg bg-zinc-800/60 p-3 ring-1 ring-zinc-700">
            <p className="font-semibold text-white">主選單</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              3 張卡片帶即時案件數徽章，待派案 &gt; 0 會橘色警示提醒
            </p>
          </li>
          <li className="rounded-lg bg-zinc-800/60 p-3 ring-1 ring-zinc-700">
            <p className="font-semibold text-white">一周排案 timeline</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              欄=7 日、列=4 位師傅 + 「未指派」列；橫向滑動。某師傅當天無案會顯示「·」。可上/下/本週切換。Tap 任一 chip 跳訂單詳情。
            </p>
          </li>
          <li className="rounded-lg bg-amber-900/30 p-3 ring-1 ring-amber-700/50">
            <p className="font-semibold text-amber-200">待派案（按地址鄉鎮分組）</p>
            <p className="mt-0.5 text-xs text-amber-100/70">
              同鄉鎮的案件自動聚在一起，方便挑順路師傅。每張卡片含客戶、地址（一鍵 Google Map）、品項、估時、暫估金額。底部下拉選師傅 → 一鍵「派工」。
            </p>
          </li>
          <li className="rounded-lg bg-emerald-900/30 p-3 ring-1 ring-emerald-700/50">
            <p className="font-semibold text-emerald-100">今日回繳一鍵清</p>
            <p className="mt-0.5 text-xs text-emerald-100/70">
              依日期顯示各師傅當日「現金 + 待回繳」訂單。頂部大字顯示總額。展開明細逐筆比對 → 按「確認回繳無誤」一鍵全部標記 settled。可切日期回看過往。
            </p>
          </li>
          <li className="rounded-lg bg-zinc-800/60 p-3 ring-1 ring-zinc-700">
            <p className="font-semibold text-white">兩階段價格策略</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              老闆娘建單時只選 6 大類基本價（電話接單不用問機型品牌），待派案卡片金額顯示「暫估」。師傅現場到客戶家換成實際 service_item 後，trigger 自動更新真實 total。
            </p>
          </li>
          <li className="rounded-lg bg-zinc-800/60 p-3 ring-1 ring-zinc-700">
            <p className="font-semibold text-white">權限</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              /manager/* layout 用 requireRole([&quot;owner&quot;]) 守衛。manager / technician / 未登入都會被導去 /unauthorized 或 /login。
            </p>
          </li>
        </ol>

        <div className="flex gap-2">
          <a
            href="/manager"
            target="_blank"
            rel="noopener"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-brand-700 bg-brand-700/30 px-3 py-2 text-sm text-brand-100 hover:bg-brand-700/50"
          >
            開新分頁全螢幕看
          </a>
          <a
            href="/dashboard"
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <LogOut className="h-4 w-4" /> 回後台
          </a>
        </div>
      </aside>
    </div>
  );
}
