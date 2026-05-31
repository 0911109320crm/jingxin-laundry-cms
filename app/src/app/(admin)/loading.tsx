import { PageSkeleton } from "@/components/ui/Skeleton";

// 後台任一頁載入中時，內容區即時顯示骨架(側欄保留)，讓使用者知道在讀取而非當機。
export default function Loading() {
  return <PageSkeleton />;
}
