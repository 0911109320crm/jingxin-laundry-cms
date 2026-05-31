-- ============================================================================
-- 0031 查帳顧客過濾改方案1：加入日≥成立日 或 有成立後訂單 才顯示
-- ============================================================================
-- 老闆娘 2026-05-31 決定（方案1）：
--   顧客在查帳帳號出現的條件 = 原始加入日(joined_at) >= 成立日
--                              或 該顧客有任何「訂單日 >= 成立日」的訂單。
--   → 不會出現「有訂單卻沒客戶名」的孤兒；純成立前往來、之後沒再服務的舊客才隱藏。
--   （訂單本身仍永遠只看得到成立日後的，與本檔無關。）
-- 用 security-definer 函式查訂單，避免 customers↔orders policy 遞迴。
-- ============================================================================

create or replace function public._customer_has_postfloor_order(cid uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.customer_id = cid
      and (coalesce(o.service_at, o.scheduled_at, o.created_at) at time zone 'Asia/Taipei')::date
          >= public.audit_floor()
  )
$$;

drop policy if exists audit_floor_customers on public.customers;
create policy audit_floor_customers on public.customers as restrictive for select
  using (
    public.audit_floor() is null
    or coalesce(customers.joined_at, (customers.created_at at time zone 'Asia/Taipei')::date)
       >= public.audit_floor()
    or public._customer_has_postfloor_order(customers.id)
  );
