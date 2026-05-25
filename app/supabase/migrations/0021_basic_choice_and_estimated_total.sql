-- ============================================================================
-- 0021 老闆娘建單兩階段價格策略
-- ============================================================================
-- 動機（2026-05-25 與 RC 確認）：
--
-- 老闆娘建單時其實不知道客戶機型/品牌/容量（電話接單時客戶說不清楚），
-- 所以決定改成兩階段：
--   1. 老闆娘只選每個機型大類的「基本價代表」(is_basic_choice=true)，
--      暫估金額寫入 orders.estimated_total
--   2. 師傅現場看到機器後，在 PWA 換成實際的 service_item（含品牌/容量），
--      補機器資料、確認加減項。order_items / order_adjustments 變動會由
--      既有 trigger refresh_order_totals 自動重算 orders.total (= 實際金額)。
--
-- 報表/薪資/抽成一律以 orders.total 為準，estimated_total 僅供老闆娘核帳對比。
--
-- 每個 category 標 1 個基本價代表：
--   washing_vertical → WV-S (1800)
--   washing_drum     → WD-L1 (4000)
--   sofa             → SF-80 (1500)
--   mattress         → BD-S (1300)          ← 床墊乾式為基本
--   ac_split         → AC-S (2500)
--   ac_hidden        → AH-S (2500)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) service_items.is_basic_choice
-- ---------------------------------------------------------------------------
alter table public.service_items
  add column if not exists is_basic_choice boolean not null default false;

comment on column public.service_items.is_basic_choice is
  '老闆娘建單下拉是否顯示此項。每個 category 應該只有 1 項 = true（最便宜的代表）。'
  '師傅 PWA 換實際品項時則顯示全部 (is_basic_choice 不過濾)。';

-- 先全部歸零（重跑 safe）
update public.service_items set is_basic_choice = false;

-- 標記基本價
update public.service_items set is_basic_choice = true
where code in ('WV-S', 'WD-L1', 'SF-80', 'BD-S', 'AC-S', 'AH-S');

-- ---------------------------------------------------------------------------
-- 2) orders.estimated_total
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists estimated_total numeric(10,2);

comment on column public.orders.estimated_total is
  '老闆娘建單時的暫估金額（用 basic_choice 預設價算）。'
  '師傅完工後實際金額會由 trigger 自動寫到 orders.total。'
  'estimated_total 僅供老闆娘對比參考，不進薪資/報表。';

-- 回填既有訂單：把現有 total 複製進去當基準
update public.orders
  set estimated_total = total
where estimated_total is null;
