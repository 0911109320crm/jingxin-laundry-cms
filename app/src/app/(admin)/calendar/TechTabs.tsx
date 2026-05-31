import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { techHex } from "@/lib/tech-colors";

export type TechOption = { id: string; name: string };

// 未指定代表色的師傅(備援)依序套用
const FALLBACK_HEX = ["#4f46e5", "#0891b2", "#16a34a", "#ea580c", "#db2777", "#9333ea"];

export function TechTabs({
  current,
  techs,
}: {
  current: string; // tech id or "all"
  techs: TechOption[];
}) {
  if (techs.length === 0) return null;
  // 把「全部」當第一個選項
  const options: { id: string; name: string }[] = [
    { id: "all", name: "全部師傅" },
    ...techs,
  ];
  const currentIdx = Math.max(
    0,
    options.findIndex((t) => t.id === current),
  );
  const prev = options[(currentIdx - 1 + options.length) % options.length];
  const next = options[(currentIdx + 1) % options.length];

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/calendar?tech=${prev.id}`}
        className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-600 hover:bg-zinc-50"
        aria-label="前一個師傅"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-zinc-100 p-1">
        {options.map((t, idx) => {
          const active = t.id === current;
          const isAll = t.id === "all";
          // 師傅按鈕整顆「持續」顯示代表色；被選中時全亮+外框，未選中時稍微淡化
          const hex = isAll ? null : techHex(t.name) ?? FALLBACK_HEX[(idx - 1) % FALLBACK_HEX.length];
          return (
            <Link
              key={t.id}
              href={`/calendar?tech=${t.id}`}
              data-active={active}
              style={hex ? { backgroundColor: hex } : undefined}
              className={cn(
                "inline-flex items-center rounded px-3 py-1.5 text-sm font-medium transition-all",
                isAll
                  ? active
                    ? "bg-zinc-800 text-white"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  : cn(
                      "text-white",
                      active
                        ? "opacity-100 ring-2 ring-zinc-800 ring-offset-1"
                        : "opacity-60 hover:opacity-90",
                    ),
              )}
            >
              {t.name}
            </Link>
          );
        })}
      </div>
      <Link
        href={`/calendar?tech=${next.id}`}
        className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-600 hover:bg-zinc-50"
        aria-label="下一個師傅"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
