-- ============================================================================
-- 0006 Google 五星好評追蹤
-- ============================================================================
-- 老闆娘看到客戶在 Google 留下五星好評後，到該筆訂單詳情頁標記。
-- 系統紀錄評論時間 + 歸屬師傅，作為師傅積分依據（純計數 + 排行榜，
-- 將來若決定要換算金額進薪資再延伸）。
--
-- 假設：一張訂單通常只有一位師傅。預設歸屬 = 訂單最早被指派的 order_items.technician_id。
-- ============================================================================

alter table public.orders
  add column got_5star_review     boolean not null default false,
  add column reviewed_at          timestamptz,
  add column review_credited_to   uuid references public.user_profiles(id) on delete set null;

-- 為了排行榜查詢效率
create index idx_orders_review_credited
  on public.orders (review_credited_to, reviewed_at)
  where got_5star_review = true;
