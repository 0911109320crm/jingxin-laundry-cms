"use client";

import { useRouter } from "next/navigation";

export function DateNav({ value }: { value: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      defaultValue={value}
      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
      onChange={(e) => {
        const v = e.target.value;
        if (v) router.push(`/manager/settle-today?date=${v}`);
      }}
    />
  );
}
