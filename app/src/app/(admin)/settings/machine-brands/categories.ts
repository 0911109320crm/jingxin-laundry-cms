export const CATEGORIES = [
  { key: "washing_vertical", label: "直立式洗衣機" },
  { key: "washing_drum", label: "滾筒洗衣機" },
  { key: "ac_split", label: "分離式冷氣" },
  { key: "ac_hidden", label: "吊隱式冷氣" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];
