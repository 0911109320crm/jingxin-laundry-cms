// service_items.category 標準值（與 machine_brands / service_tag_presets 同步）
export const SERVICE_CATEGORIES = [
  { key: "washing_vertical", label: "直立式洗衣機" },
  { key: "ac_split", label: "分離式冷氣" },
  { key: "washing_drum", label: "滾筒洗衣機" },
  { key: "mattress", label: "床墊" },
  { key: "sofa", label: "沙發" },
  { key: "ac_hidden", label: "吊隱式冷氣" },
  { key: "washing_twin_tub", label: "雙槽式洗衣機" },
] as const;

export type ServiceCategoryKey = (typeof SERVICE_CATEGORIES)[number]["key"];

// 老闆娘指定的服務項目顯示順序（單一來源；建單下拉、管理頁、任何選服務項目的 UI 都用這個）
export const SERVICE_CATEGORY_ORDER: string[] = SERVICE_CATEGORIES.map((c) => c.key);

export const SERVICE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.key, c.label]),
);
