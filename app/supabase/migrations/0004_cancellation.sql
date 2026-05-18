-- ============================================================================
-- 0004 訂單取消原因 + 取消時間
-- ============================================================================
-- 用於老闆娘在月曆上快速取消訂單時記錄原因，
-- 未來可在顧客詳情頁統計「臨時取消次數」。
-- ============================================================================

alter table public.orders
  add column cancellation_reason text,
  add column cancelled_at        timestamptz;

create index idx_orders_cancelled on public.orders (status, cancelled_at)
  where status = 'cancelled';
