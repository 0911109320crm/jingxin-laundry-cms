/**
 * 現金待回繳的「責任歸屬」邏輯。
 *
 * 行動車一單多服務時可能同時派多位師傅，最後離開的人常幫忙收走整張單的現金
 * （老闆娘 2026-05-29）。因此回繳責任應歸「實際收款人」(orders.collected_by_technician_id)，
 * 而非做工的某位師傅。
 */

/** 分組時用來代表「查無收款人」的 key。 */
export const UNASSIGNED = "__unassigned__";

/**
 * 決定一張訂單的現金回繳責任人。
 * 優先採用實際收款人；舊資料（collected_by 為 null）回退用最早指派的 item 師傅推測，
 * 維持與本功能上線前一致的行為。
 */
export function resolveCollector(
  collectedBy: string | null | undefined,
  items: { technician_id: string | null; created_at: string }[],
): string {
  if (collectedBy) return collectedBy;
  const earliest = [...items]
    .filter((it) => it.technician_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  return earliest?.technician_id ?? UNASSIGNED;
}
