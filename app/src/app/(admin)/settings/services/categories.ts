// service_items.category 標準值（與 machine_brands / service_tag_presets 同步）
export const SERVICE_CATEGORIES = [
  { key: "washing_vertical", label: "直立式洗衣機" },
  { key: "washing_twin_tub", label: "雙槽式洗衣機" },
  { key: "washing_drum", label: "滾筒洗衣機" },
  { key: "sofa", label: "沙發" },
  { key: "mattress", label: "床墊" },
  { key: "ac_split", label: "分離式冷氣" },
  { key: "ac_hidden", label: "吊隱式冷氣" },
] as const;

export type ServiceCategoryKey = (typeof SERVICE_CATEGORIES)[number]["key"];

export const SERVICE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.key, c.label]),
);
