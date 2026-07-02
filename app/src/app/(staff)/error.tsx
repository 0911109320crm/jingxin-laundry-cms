"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * 師傅 PWA 區段錯誤邊界。
 * iOS 左滑返回/收款後重新整理時，若 RSC 取資料失敗(工作階段逾時等)，
 * 舊行為會變成整片空白，師傅只能登出重登。這裡改成顯示可一鍵恢復的畫面：
 * - 「重新整理」用整頁重載(觸發 proxy 重新刷新 session cookie)。
 * - 「重新登入」導回登入頁重建工作階段。
 */
export default function StaffError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 方便日後在瀏覽器 console 追查
    console.error("[staff] route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <div className="space-y-1">
        <p className="text-base font-medium text-zinc-800">畫面載入發生問題</p>
        <p className="text-sm text-zinc-500">
          可能是連線逾時或工作階段過期，您的案件資料並未遺失。
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => window.location.assign("/staff")}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white active:bg-brand-700"
        >
          重新整理
        </button>
        <a
          href="/login?next=/staff"
          className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 active:bg-zinc-100"
        >
          重新登入
        </a>
      </div>
    </div>
  );
}
