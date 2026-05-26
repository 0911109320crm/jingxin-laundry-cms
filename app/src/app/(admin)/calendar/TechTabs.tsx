import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type TechOption = { id: string; name: string };

const TAB_COLORS = [
  "data-[active=true]:bg-indigo-600 data-[active=true]:text-white",
  "data-[active=true]:bg-cyan-600 data-[active=true]:text-white",
  "data-[active=true]:bg-green-600 data-[active=true]:text-white",
  "data-[active=true]:bg-orange-600 data-[active=true]:text-white",
  "data-[active=true]:bg-pink-600 data-[active=true]:text-white",
  "data-[active=true]:bg-purple-600 data-[active=true]:text-white",
];

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
          // 「全部」用 zinc 色，師傅依序套 TAB_COLORS
          const color =
            t.id === "all"
              ? "data-[active=true]:bg-zinc-800 data-[active=true]:text-white"
              : TAB_COLORS[(idx - 1) % TAB_COLORS.length];
          return (
            <Link
              key={t.id}
              href={`/calendar?tech=${t.id}`}
              data-active={active}
              className={cn(
                "inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-white",
                color,
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
