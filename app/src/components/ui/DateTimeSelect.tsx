"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type Parts = { date: string; hour: string; minute: string };

function parseValue(value: string): Parts {
  if (!value) return { date: "", hour: "", minute: "" };
  const m = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return { date: "", hour: "", minute: "" };
  return { date: m[1], hour: m[2], minute: m[3] };
}

function compose(date: string, hour: string, minute: string): string {
  if (!date) return "";
  const h = hour || "09";
  const mm = minute || "00";
  return `${date}T${h}:${mm}`;
}

export function DateTimeSelect({
  value,
  onChange,
  minuteStep = 5,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  minuteStep?: number;
}) {
  const { date, hour, minute } = parseValue(value ?? "");

  const hours = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0"),
  );

  const minuteSet = new Set<string>();
  for (let m = 0; m < 60; m += minuteStep) {
    minuteSet.add(String(m).padStart(2, "0"));
  }
  if (minute && !minuteSet.has(minute)) minuteSet.add(minute);
  const minutes = Array.from(minuteSet).sort();

  return (
    <div className="flex flex-wrap gap-2">
      <Input
        type="date"
        value={date}
        onChange={(e) =>
          onChange(compose(e.target.value, hour, minute))
        }
        // 給足寬度顯示完整 年/月/日；窄欄時時分下拉自動換行(flex-wrap)
        className="min-w-[9.5rem] flex-1"
      />
      <Select
        value={hour}
        onChange={(e) => onChange(compose(date, e.target.value, minute))}
        className="w-[4.5rem] shrink-0"
        aria-label="小時"
      >
        <option value="">時</option>
        {hours.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </Select>
      <Select
        value={minute}
        onChange={(e) => onChange(compose(date, hour, e.target.value))}
        className="w-[4.5rem] shrink-0"
        aria-label="分鐘"
      >
        <option value="">分</option>
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </Select>
    </div>
  );
}
