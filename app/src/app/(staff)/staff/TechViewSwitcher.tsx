"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 主管級(owner/manager/can_view_all)在師傅 PWA 頁面內切換檢視不同師傅。
 * 切換邏輯內聚在這頁，不再放在 /demo/pwa 的外框頂部(那會重複出現切換列)。
 * 一般師傅不會收到這個元件(由 /staff 以登入者權限把關)。
 */
export function TechViewSwitcher({
  technicians,
  currentId,
  selfId,
}: {
  technicians: { id: string; name: string }[];
  currentId: string;
  selfId: string;
}) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-2.5">
      <p className="mb-1.5 flex items-center gap-1 px-0.5 text-xs font-medium text-indigo-700">
        <Eye className="h-3.5 w-3.5" />
        切換檢視師傅
      </p>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {technicians.map((t) => {
          const active = t.id === currentId;
          const isSelf = t.id === selfId;
          return (
            <Link
              key={t.id}
              href={isSelf ? "/staff" : `/staff?as=${t.id}`}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-indigo-600 font-medium text-white"
                  : "border border-indigo-200 bg-white text-zinc-600 hover:bg-indigo-100",
              )}
            >
              {t.name}
              {isSelf ? "（我）" : ""}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
