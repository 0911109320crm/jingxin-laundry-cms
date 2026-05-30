-- ============================================================================
-- 0025 訂單品項「金額已確認」標記（多師傅同單收款用）
-- ============================================================================
-- 需求（2026-05-30）：多位師傅同到一案家，各自服務不同品項，實際金額只有現場
-- 師傅自己知道（可能臨時加項、折扣、或某項不服務）。設計成每位師傅在現場確認
-- 「自己負責品項」的金額後標記 confirmed；當整單所有未排除(excluded=false)的
-- 品項都 confirmed=true 時，才開放收款——收款鈕自然出現在「最後一位確認完成」
-- 的師傅(=最後做完的人)面前，由他向客戶收全額。符合老闆娘「最後一人收」的默契，
-- 系統不需預測誰最後。
--
-- 設計：
--   - 加 order_items.confirmed boolean，預設 false
--   - 師傅確認自己金額時，把自己負責(technician_id=自己)的未排除 item 設 true
--   - 收款閘門：整單不存在 (excluded=false AND confirmed=false) 的 item
--   - excluded=true（不服務）的品項不需確認、不納入閘門
--   - 老闆娘後台可代為確認（防師傅忘確認就離開造成卡死）
-- ============================================================================

alter table public.order_items
  add column if not exists confirmed boolean not null default false;

comment on column public.order_items.confirmed is
  '師傅已在現場確認此品項實際金額。多師傅同單收款閘門：整單所有 excluded=false 品項皆 confirmed 才開放收款。';
