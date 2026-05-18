-- ============================================================================
-- 0003 訂單加結束時間
-- ============================================================================
-- 月曆 event 需要 start + end 才能顯示時間區段（10:00-11:30）。
-- 沒填 scheduled_end_at 的訂單，月曆畫面會以「scheduled_at + 1 小時」呈現。
-- ============================================================================

alter table public.orders
  add column scheduled_end_at timestamptz;

create index idx_orders_scheduled_end on public.orders (scheduled_end_at);
