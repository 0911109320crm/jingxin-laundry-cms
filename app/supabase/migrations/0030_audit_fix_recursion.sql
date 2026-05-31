-- ============================================================================
-- 0030 修正 0029 的 RLS 無限遞迴
-- ============================================================================
-- 0029 的子表 SELECT policy 用 `exists(select from 父表)`，與父表既有 policy
-- 形成 orders↔order_items 循環 → "infinite recursion detected in policy"。
-- 改用 security-definer 函式讀父表日期（繞過 RLS、policy 內不再參照父表）→ 斷開循環。
-- ============================================================================

create or replace function public._order_visible(oid uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select public.audit_floor() is null
    or coalesce(
        (select (coalesce(o.service_at, o.scheduled_at, o.created_at) at time zone 'Asia/Taipei')::date
                 >= public.audit_floor()
         from public.orders o where o.id = oid),
        true)
$$;

create or replace function public._customer_visible(cid uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select public.audit_floor() is null
    or coalesce(
        (select (c.created_at at time zone 'Asia/Taipei')::date >= public.audit_floor()
         from public.customers c where c.id = cid),
        true)
$$;

-- 重建子表 SELECT policy（不再參照父表）
drop policy if exists audit_floor_order_items on public.order_items;
create policy audit_floor_order_items on public.order_items as restrictive for select
  using (public._order_visible(order_id));

drop policy if exists audit_floor_order_adjustments on public.order_adjustments;
create policy audit_floor_order_adjustments on public.order_adjustments as restrictive for select
  using (public._order_visible(order_id));

drop policy if exists audit_floor_order_promotions on public.order_promotions;
create policy audit_floor_order_promotions on public.order_promotions as restrictive for select
  using (public._order_visible(order_id));

drop policy if exists audit_floor_customer_addresses on public.customer_addresses;
create policy audit_floor_customer_addresses on public.customer_addresses as restrictive for select
  using (public._customer_visible(customer_id));

drop policy if exists audit_floor_customer_phones on public.customer_phones;
create policy audit_floor_customer_phones on public.customer_phones as restrictive for select
  using (public._customer_visible(customer_id));

drop policy if exists audit_floor_machines on public.machines;
create policy audit_floor_machines on public.machines as restrictive for select
  using (public._customer_visible(customer_id));
