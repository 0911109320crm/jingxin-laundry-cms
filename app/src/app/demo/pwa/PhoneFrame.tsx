"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Home, ClipboardList, LogOut } from "lucide-react";

export function PhoneFrame({ userName }: { userName: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [bust, setBust] = useState(0);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const timeLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const reload = () => {
    setBust((b) => b + 1);
  };

  const navigateIframe = (path: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      iframe.contentWindow?.location.assign(path);
    } catch {
      // cross-origin shouldn't happen (same-origin), fallback to src
      iframe.src = path;
    }
  };

  const src = `/staff?_=${bust}`;

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
              ref={iframeRef}
              key={bust}
              src={src}
              className="absolute inset-0 h-full w-full border-0"
              title="師傅 PWA 預覽"
            />
          </div>
        </div>
      </div>

      {/* Control panel — hidden in print / OBS window-only capture */}
      <aside className="mt-6 w-full max-w-sm space-y-4 lg:mt-0 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-white">師傅 PWA 示範</h1>
          <p className="mt-1 text-sm text-zinc-400">
            目前以「{userName}」身份顯示。實際師傅看到的會是自己的當日案件。
          </p>
        </div>

        <div className="space-y-2 rounded-lg bg-zinc-800/60 p-3 ring-1 ring-zinc-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            快速操作
          </p>
          <button
            type="button"
            onClick={reload}
            className="flex w-full items-center gap-2 rounded bg-zinc-700 px-3 py-2 text-sm text-white transition-colors hover:bg-zinc-600"
          >
            <RefreshCw className="h-4 w-4" /> 重新載入 iframe（錄影重來）
          </button>
          <button
            type="button"
            onClick={() => navigateIframe("/staff")}
            className="flex w-full items-center gap-2 rounded bg-zinc-700 px-3 py-2 text-sm text-white transition-colors hover:bg-zinc-600"
          >
            <Home className="h-4 w-4" /> 跳到今日列表
          </button>
          <button
            type="button"
            onClick={() => navigateIframe("/staff/payroll")}
            className="flex w-full items-center gap-2 rounded bg-zinc-700 px-3 py-2 text-sm text-white transition-colors hover:bg-zinc-600"
          >
            <ClipboardList className="h-4 w-4" /> 跳到我的薪資
          </button>
        </div>

        <div className="rounded-lg bg-zinc-800/60 p-3 ring-1 ring-zinc-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            錄影建議
          </p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-300">
            <li>• 用 OBS / Loom 視窗錄製，只框選手機區域</li>
            <li>• 瀏覽器先按 F11 全螢幕，畫面更乾淨</li>
            <li>• 操作節奏放慢，每步停 1-2 秒方便看</li>
            <li>• 完成案件 dialog 是 demo 重點</li>
          </ul>
        </div>

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
