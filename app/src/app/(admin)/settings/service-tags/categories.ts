// 4 種標籤分組（注意：吊隱式冷氣共用 ac_split 標籤；沙發共用 mattress 標籤，
// 故管理頁只列出 4 組，UI 載入時做 fallback）
export const TAG_CATEGORIES = [
  { key: "washing_vertical", label: "直立式洗衣機" },
  { key: "washing_drum", label: "滾筒洗衣機" },
  { key: "ac_split", label: "冷氣（分離式 + 吊隱式共用）" },
  { key: "mattress", label: "床墊 + 沙發（共用髒污標籤）" },
] as const;

export type TagCategoryKey = (typeof TAG_CATEGORIES)[number]["key"];
