"use client";

/**
 * PWA 安裝提示按鈕。
 *
 * 邏輯：
 *  1. Android Chrome / Edge: 攔截 beforeinstallprompt event，顯示客製按鈕
 *  2. iOS Safari: 偵測平台後顯示「分享 → 加到主畫面」說明卡
 *  3. 已安裝為 PWA (display-mode: standalone) → 不顯示
 *  4. 使用者點「以後再說」→ localStorage 記住，7 天內不再顯示
 */
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 7;

export function PWAInstallButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [hidden, setHidden] = useState(true); // 預設藏，下面 effect 決定要不要顯示

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 已安裝為 PWA — 不顯示
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // @ts-expect-error iOS Safari only
    if (window.navigator.standalone === true) return;

    // 7 天內被 dismiss 過 — 不顯示
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const days = (Date.now() - parseInt(dismissedAt, 10)) / 86400000;
      if (days < DISMISS_DAYS) return;
    }

    // iOS Safari detect
    const ua = navigator.userAgent;
    const iosDevice = /iPhone|iPad|iPod/.test(ua) && !("MSStream" in window);
    const isInSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (iosDevice && isInSafari) {
      setIsIOS(true);
      setHidden(false);
      return;
    }

    // Android / desktop Chrome / Edge: 等 beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const onInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setHidden(true);
    setInstallEvent(null);
  };

  const onDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  };

  if (hidden) return null;

  // iOS 用說明卡
  if (isIOS) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-30 rounded-xl border border-brand-200 bg-white p-4 shadow-lg"
           style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-start gap-3">
          <Download className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div className="flex-1 text-sm">
            <p className="font-bold text-zinc-900 mb-1">把這個 App 加到主畫面</p>
            <p className="text-zinc-600">
              點下方 <b>分享 ⤴</b> → <b>加到主畫面</b>，下次點圖示就直接打開。
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="關閉"
            className="rounded-full p-1 text-zinc-400 active:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {showIOSHint && null}
      </div>
    );
  }

  // Android / Desktop 用 install 按鈕
  return (
    <div className="fixed bottom-20 left-3 right-3 z-30 rounded-xl border border-brand-200 bg-white p-4 shadow-lg flex items-center gap-3"
         style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      <Download className="h-5 w-5 shrink-0 text-brand-600" />
      <div className="flex-1 text-sm">
        <p className="font-bold text-zinc-900">安裝到主畫面</p>
        <p className="text-zinc-500 text-xs">下次點圖示就打開，跟一般 App 一樣</p>
      </div>
      <button
        type="button"
        onClick={onInstall}
        className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white active:bg-brand-700"
      >
        安裝
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="關閉"
        className="rounded-full p-1 text-zinc-400 active:bg-zinc-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
