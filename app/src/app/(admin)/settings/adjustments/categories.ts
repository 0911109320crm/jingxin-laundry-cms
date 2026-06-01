// 加減項分類（顯示用）。type 仍管金額 +/-；category 管分組。
export type AdjCategory = "service" | "parts" | "discount";

export const ADJ_CATEGORY_LABEL: Record<AdjCategory, string> = {
  service: "服務加收",
  parts: "零件加收",
  discount: "優惠折扣",
};

export const ADJ_CATEGORY_ORDER: AdjCategory[] = ["service", "parts", "discount"];

// category → order_adjustments.type（service/parts 都是加價，discount 是折扣）
export function typeForCategory(category: AdjCategory): "addon" | "discount" {
  return category === "discount" ? "discount" : "addon";
}
