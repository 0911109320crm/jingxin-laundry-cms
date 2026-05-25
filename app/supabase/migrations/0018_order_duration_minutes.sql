-- ============================================================================
-- 0018 訂單預計時長獨立欄位
-- ============================================================================
-- 之前 duration 只透過 scheduled_at + scheduled_end_at 隱含表達；
-- 一旦訂單沒有 scheduled_at（待派工狀態）就完全失去這個資訊，
-- 老闆娘安排時間時無法估算每筆會花多久。
--
-- 改成獨立欄位 duration_minutes：
--   - 老闆娘建單時永遠寫入（不管 scheduled_at 有沒有填）
--   - 待派工卡片直接顯示「預計 N 分」
--   - 拖到月曆 fallback 不再寫死 90
--
-- 回填：既有訂單若有 scheduled_at + scheduled_end_at → 用差距；否則 90。
-- ============================================================================

alter table public.orders
  add column if not exists duration_minutes integer not null default 90;

-- 回填既有訂單
update public.orders
set duration_minutes = greatest(
  15,
  extract(epoch from (scheduled_end_at - scheduled_at))::int / 60
)
where scheduled_at is not null
  and scheduled_end_at is not null
  and scheduled_end_at > scheduled_at;

comment on column public.orders.duration_minutes is
  '預計服務時長（分鐘）。獨立於 scheduled_at / scheduled_end_at，待派工也保留。';
