/**
 * 師傅代表色（月曆排案）。老闆娘 2026-06-01 指定：
 *   陳昶志=綠、徐祥瑋=紫、羅允辰=橘、葉翰霖=藍、楊仕丞=灰。
 * 以「名字包含」比對，容許資料庫名字帶前綴(例 "A-陳昶志")或日後微調。
 * 找不到對應(新師傅)時，呼叫端用既有的索引調色盤 fallback。
 */
export const TECH_NAME_COLORS: Array<{
  match: string;
  hex: string;
  tab: string;
}> = [
  { match: "陳昶志", hex: "#16a34a", tab: "data-[active=true]:bg-green-600 data-[active=true]:text-white" },
  { match: "徐祥瑋", hex: "#9333ea", tab: "data-[active=true]:bg-purple-600 data-[active=true]:text-white" },
  { match: "羅允辰", hex: "#ea580c", tab: "data-[active=true]:bg-orange-600 data-[active=true]:text-white" },
  { match: "葉翰霖", hex: "#2563eb", tab: "data-[active=true]:bg-blue-600 data-[active=true]:text-white" },
  { match: "楊仕丞", hex: "#6b7280", tab: "data-[active=true]:bg-zinc-600 data-[active=true]:text-white" },
];

/** 依師傅名字回傳指定的 hex 代表色；沒指定回 null。 */
export function techHex(name: string | null | undefined): string | null {
  if (!name) return null;
  for (const c of TECH_NAME_COLORS) if (name.includes(c.match)) return c.hex;
  return null;
}

/** 依師傅名字回傳指定的分頁高亮 class；沒指定回 null。 */
export function techTab(name: string | null | undefined): string | null {
  if (!name) return null;
  for (const c of TECH_NAME_COLORS) if (name.includes(c.match)) return c.tab;
  return null;
}
