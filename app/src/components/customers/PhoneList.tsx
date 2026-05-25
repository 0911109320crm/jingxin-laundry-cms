import { Phone } from "lucide-react";

/**
 * 共用客戶電話顯示元件。
 *
 * mode:
 *   - "inline" (預設): 「☎ 主電話 +N」，hover tooltip 顯示副電話列表。
 *      適合列表 / 卡片場景。
 *   - "stack": 一行一支電話，主電話粗體 + 標籤顯示。
 *      適合詳細頁 / side panel。
 *
 * fallback: 若沒傳 phones（DB 還沒灌 customer_phones）會用 primary 補一筆。
 */
export type PhoneItem = {
  id?: string;
  phone: string;
  label?: string | null;
  is_primary: boolean;
  sort_order?: number;
};

type Props = {
  /** 客戶所有電話。若 undefined / 空陣列 → fallback 到 `primary`。 */
  phones?: PhoneItem[] | null;
  /** 主電話 (fallback 用，通常是 customers.phone)。 */
  primary: string;
  mode?: "inline" | "stack";
  /** 額外 className 套到外層 wrapper。 */
  className?: string;
};

function sortPhones(arr: PhoneItem[]): PhoneItem[] {
  return [...arr].sort((a, b) => {
    // 主電話排第一
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

export function PhoneList({ phones, primary, mode = "inline", className = "" }: Props) {
  const items: PhoneItem[] =
    phones && phones.length > 0
      ? sortPhones(phones)
      : [{ phone: primary, is_primary: true }];

  if (mode === "stack") {
    return (
      <div className={`space-y-0.5 ${className}`}>
        {items.map((p, i) => (
          <a
            key={p.id ?? i}
            href={`tel:${p.phone}`}
            className={`flex items-center gap-1.5 text-sm ${
              p.is_primary
                ? "font-medium text-brand-700"
                : "text-zinc-600"
            }`}
          >
            <Phone className="h-3.5 w-3.5" /> {p.phone}
            {p.label && (
              <span className="text-xs text-zinc-500">({p.label})</span>
            )}
          </a>
        ))}
      </div>
    );
  }

  // inline 模式
  const main = items[0];
  const extras = items.slice(1);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Phone className="h-3 w-3" /> {main.phone}
      {extras.length > 0 && (
        <span
          className="ml-1 rounded bg-zinc-100 px-1 text-[10px] text-zinc-600"
          title={extras
            .map((p) => `${p.phone}${p.label ? `（${p.label}）` : ""}`)
            .join("、")}
        >
          +{extras.length}
        </span>
      )}
    </span>
  );
}
