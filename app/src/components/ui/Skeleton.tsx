/**
 * 載入骨架。用 Tailwind animate-pulse（動畫只改 opacity → 走合成器執行緒、不吃主執行緒、不會 lag）。
 * 換頁時由各 route 的 loading.tsx 即時顯示，讓使用者知道「在讀取」而非當機。
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-200/80 ${className}`} />;
}

/** 一般後台頁面的通用載入骨架（標題 + KPI 卡 + 清單列）。 */
export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
      <p className="pt-1 text-center text-xs text-zinc-400">載入中…</p>
    </div>
  );
}

/** PWA(手機)頁面的載入骨架（卡片堆疊）。 */
export function MobileSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-6 w-40" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
      <p className="pt-1 text-center text-xs text-zinc-400">載入中…</p>
    </div>
  );
}
