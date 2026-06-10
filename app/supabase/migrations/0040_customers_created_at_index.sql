-- ============================================================================
-- 0040 customers.created_at 索引 → 解顧客頁查帳帳號 statement timeout
-- ============================================================================
-- 問題：顧客列表 `order by created_at desc limit 100`。customers 無 created_at 索引，
--   planner 只能全表掃 10000+ 列再排序。查帳(readonly)帳號的 RLS restrictive policy
--   `audit_floor_customers` 對「floor 之前建立」的顧客會逐列呼叫
--   _customer_has_postfloor_order(id)（EXISTS 子查詢），全表掃時等於對數千列各跑一次
--   子查詢 → 經 PostgREST + 三層 embed 放大到 ~8s → 撞 statement timeout。
-- 修法：加 btree 索引 (created_at desc)。planner 改走 index scan 由新到舊取前 100，
--   最新 100 筆皆 created_at >= floor（policy 第二段 true 短路），完全不會碰到
--   postfloor 函式 → 8s 降到 ~60ms。一般帳號也同步受惠（排序免全表 sort）。
-- 實測(raw SQL, 查帳帳號 RLS)：1607ms → 60ms；經 app 主查詢 8164ms → 220ms。
-- ============================================================================

create index if not exists idx_customers_created_at
  on public.customers (created_at desc);
