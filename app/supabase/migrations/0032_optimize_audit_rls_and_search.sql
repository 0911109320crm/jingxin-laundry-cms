-- ============================================================================
-- 0032 優化查帳 RLS 效能 + order_items.item_code 加 trigram 索引
-- ============================================================================
-- 問題：0029~0031 的查帳 RLS 讓一般帳號(老闆娘)搜尋變慢近一倍——子表 policy 把
--   「audit_floor() is null」判斷藏在 security-definer 函式內、逐列呼叫。
-- 修法(Gemini + Claude 雙確認，低風險、標準模式)：
--   1. 所有 audit_floor() 包成純量子查詢 (select public.audit_floor())
--      → planner 當 InitPlan 只算一次。
--   2. 子表 policy 把 null 判斷上移到 policy 層： (select audit_floor()) is null OR <函式>
--      → 一般帳號在 OR 第一段(常數 true)短路，不再逐列跑函式；查帳帳號(floor 非 null)
--        落到第二段做真正過濾，邏輯完全等價、資料隔離不變。
--   3. order_items.item_code 補 GIN pg_trgm 索引(原本只有 btree → ILIKE '%x%' 全表掃)。
-- ============================================================================

-- ---- 父表 ----
drop policy if exists audit_floor_customers on public.customers;
create policy audit_floor_customers on public.customers as restrictive for select
  using (
    (select public.audit_floor()) is null
    or coalesce(customers.joined_at, (customers.created_at at time zone 'Asia/Taipei')::date)
       >= (select public.audit_floor())
    or public._customer_has_postfloor_order(customers.id)
  );

drop policy if exists audit_floor_orders on public.orders;
create policy audit_floor_orders on public.orders as restrictive for select
  using (
    (select public.audit_floor()) is null
    or (coalesce(orders.service_at, orders.scheduled_at, orders.created_at) at time zone 'Asia/Taipei')::date
       >= (select public.audit_floor())
  );

-- ---- 子表(短路在 policy 層) ----
drop policy if exists audit_floor_order_items on public.order_items;
create policy audit_floor_order_items on public.order_items as restrictive for select
  using ((select public.audit_floor()) is null or public._order_visible(order_id));

drop policy if exists audit_floor_order_adjustments on public.order_adjustments;
create policy audit_floor_order_adjustments on public.order_adjustments as restrictive for select
  using ((select public.audit_floor()) is null or public._order_visible(order_id));

drop policy if exists audit_floor_order_promotions on public.order_promotions;
create policy audit_floor_order_promotions on public.order_promotions as restrictive for select
  using ((select public.audit_floor()) is null or public._order_visible(order_id));

drop policy if exists audit_floor_customer_addresses on public.customer_addresses;
create policy audit_floor_customer_addresses on public.customer_addresses as restrictive for select
  using ((select public.audit_floor()) is null or public._customer_visible(customer_id));

drop policy if exists audit_floor_customer_phones on public.customer_phones;
create policy audit_floor_customer_phones on public.customer_phones as restrictive for select
  using ((select public.audit_floor()) is null or public._customer_visible(customer_id));

drop policy if exists audit_floor_machines on public.machines;
create policy audit_floor_machines on public.machines as restrictive for select
  using ((select public.audit_floor()) is null or public._customer_visible(customer_id));

-- ---- 搜尋索引 ----
create index if not exists idx_order_items_item_code_trgm
  on public.order_items using gin (item_code gin_trgm_ops);
