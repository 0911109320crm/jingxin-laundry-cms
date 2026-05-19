"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

export function PhoneFrame({ userName }: { userName: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const timeLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-zinc-900 px-4 py-8 text-zinc-100 lg:flex-row lg:items-center lg:justify-center lg:gap-10">
      {/* Phone frame */}
      <div className="relative">
        {/* Outer shell */}
        <div
          className="relative bg-zinc-950 shadow-2xl ring-1 ring-zinc-800"
          style={{
            width: 420,
            height: 880,
            borderRadius: 55,
            padding: 14,
          }}
        >
          {/* Side buttons (decorative) */}
          <div className="absolute left-[-3px] top-[120px] h-10 w-[3px] rounded-l bg-zinc-700" />
          <div className="absolute left-[-3px] top-[180px] h-16 w-[3px] rounded-l bg-zinc-700" />
          <div className="absolute left-[-3px] top-[260px] h-16 w-[3px] rounded-l bg-zinc-700" />
          <div className="absolute right-[-3px] top-[200px] h-24 w-[3px] rounded-r bg-zinc-700" />

          {/* Screen */}
          <div
            className="relative overflow-hidden bg-white"
            style={{
              width: 392,
              height: 852,
              borderRadius: 42,
            }}
          >
            {/* Status bar — drawn over the top of the iframe */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-11 items-center justify-between px-7 text-xs font-semibold text-zinc-900">
              <span className="font-mono">{timeLabel}</span>
              <span className="flex items-center gap-1">
                <span>📶</span>
                <span>📡</span>
                <span>🔋</span>
              </span>
            </div>

            {/* Dynamic island */}
            <div className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-7 w-32 -translate-x-1/2 rounded-full bg-black" />

            <iframe
              src="/staff"
              className="absolute inset-x-0 bottom-0 w-full border-0"
              style={{ top: 44, height: "calc(100% - 44px)" }}
              title="師傅 PWA 預覽"
            />
          </div>
        </div>
      </div>

      {/* Demo script — features to walk through */}
      <aside className="mt-6 w-full max-w-sm space-y-4 lg:mt-0">
        <div>
          <h1 className="text-xl font-bold text-white">師傅 PWA 示範重點</h1>
          <p className="mt-1 text-sm text-zinc-400">
            目前以「{userName}」身份顯示
          </p>
        </div>

        <ol className="space-y-3 text-sm text-zinc-200">
          <li className="rounded-lg bg-zinc-800/60 p-3 ring-1 ring-zinc-700">
            <p className="font-semibold text-white">1. 今日案件一覽</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              按時間排序顯示，每張卡片含客戶姓名、電話、地址、服務項目、金額
            </p>
          </li>
          <li className="rounded-lg bg-zinc-800/60 p-3 ring-1 ring-zinc-700">
            <p className="font-semibold text-white">2. 待回繳現金提示</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              頁面頂端橘色橫幅顯示師傅手上未回繳的現金總額
            </p>
          </li>
          <li className="rounded-lg bg-zinc-800/60 p-3 ring-1 ring-zinc-700">
            <p className="font-semibold text-white">3. 訂單詳情</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              點任一案件 → 客戶資訊、地址（一鍵 Google 地圖導航）、服務項目、加價/折扣、應收總額
            </p>
          </li>
          <li className="rounded-lg bg-amber-900/30 p-3 ring-1 ring-amber-700/50">
            <p className="font-semibold text-amber-200">
              4. ⚠ 客戶過往師傅備註
            </p>
            <p className="mt-0.5 text-xs text-amber-100/70">
              系統自動帶出此客戶過往師傅留下的標籤與特殊備註，
              不同師傅接同一客戶也能秒懂前同仁的眉角
            </p>
          </li>
          <li className="rounded-lg bg-zinc-800/60 p-3 ring-1 ring-zinc-700">
            <p className="font-semibold text-white">5. 收款一鍵切換</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              現場按「我收到現金了」或「客戶說已匯款」即可更新狀態
            </p>
          </li>
          <li className="rounded-lg bg-brand-900/40 p-3 ring-1 ring-brand-700/50">
            <p className="font-semibold text-brand-100">6. 標記完成流程</p>
            <p className="mt-0.5 text-xs text-brand-100/70">
              彈出視窗顯示：金額再確認 + 勾選快速備註標籤（洗衣粉、無電梯…）+ 填特殊備註，10 秒搞定
            </p>
          </li>
          <li className="rounded-lg bg-zinc-800/60 p-3 ring-1 ring-zinc-700">
            <p className="font-semibold text-white">7. 完成後仍可補/改備註</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              已完成的案件按「補/修改備註」可重開對話框
            </p>
          </li>
          <li className="rounded-lg bg-zinc-800/60 p-3 ring-1 ring-zinc-700">
            <p className="font-semibold text-white">8. 我的薪資</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              下方 tab → 月度計件明細、加價/折扣明細
            </p>
          </li>
        </ol>

        <a
          href="/dashboard"
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
        >
          <LogOut className="h-4 w-4" /> 回管理後台
        </a>
      </aside>
    </div>
  );
}
