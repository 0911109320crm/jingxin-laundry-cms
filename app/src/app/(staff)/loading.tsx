import { MobileSkeleton } from "@/components/ui/Skeleton";

// 師傅 PWA 任一頁載入中時顯示骨架，避免畫面靜止像當機。
export default function Loading() {
  return <MobileSkeleton />;
}
