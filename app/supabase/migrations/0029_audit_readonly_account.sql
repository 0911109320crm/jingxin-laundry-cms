-- ============================================================================
-- 0029 查帳保險帳號：唯讀 + 資料日期下限（RLS）
-- ============================================================================
-- 老闆娘 2026-05-31 需求：開一組平常不用的唯讀帳號，登入後顧客(依建檔日)與
-- 訂單(依訂單日)只看得到「公司成立日 2022-08-11(民國111/8/11)」以後的資料。
--
-- 做法：
--   user_profiles 加 data_floor_date(資料日期下限) + readonly(完全唯讀) 兩欄。
--   用 RESTRICTIVE policy（與既有 PERMISSIVE policy AND 結合）做兩件事：
--     1. SELECT：有 data_floor_date 的使用者，只看得到日期 >= floor 的資料；
--        其餘使用者(floor 為 null)完全不受影響。
--     2. INSERT/UPDATE/DELETE：readonly 使用者一律擋下（其餘不受影響）。
--   子表(items/adjustments/addresses/phones/machines/promotions)以 EXISTS 串到
--   父表(orders/customers)，父表被 floor 擋掉 → 子表自然看不到（串聯）。
--
-- 注意：service-role(admin client) 會繞過 RLS；查帳帳號另以 proxy 鎖定只能進
--   /customers 與 /orders（這兩處的 row 都走 user client，RLS 生效）。
-- 日期換算用台灣時區。
-- ============================================================================

alter table public.user_profiles
  add column if not exists data_floor_date date,
  add column if not exists readonly boolean not null default false;

comment on column public.user_profiles.data_floor_date is
  '資料日期下限：非 null 時，該帳號只看得到此日期(含)以後的顧客(建檔日)與訂單(訂單日)。查帳用。';
comment on column public.user_profiles.readonly is
  '完全唯讀帳號：擋下所有顧客/訂單相關的新增/修改/刪除。';

-- 安全的 helper（security definer 讀 user_profiles，避免 policy 內遞迴/權限問題）
create or replace function public.audit_floor()
  returns date language sql stable security definer set search_path = public as $$
  select data_floor_date from public.user_profiles where id = auth.uid()
$$;

create or replace function public.is_readonly()
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select readonly from public.user_profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------------------
-- SELECT 過濾（RESTRICTIVE）：floor 為 null → 全放行；否則依日期
-- ---------------------------------------------------------------------------
drop policy if exists audit_floor_customers on public.customers;
create policy audit_floor_customers on public.customers as restrictive for select
  using (
    public.audit_floor() is null
    or (created_at at time zone 'Asia/Taipei')::date >= public.audit_floor()
  );

drop policy if exists audit_floor_orders on public.orders;
create policy audit_floor_orders on public.orders as restrictive for select
  using (
    public.audit_floor() is null
    or (coalesce(service_at, scheduled_at, created_at) at time zone 'Asia/Taipei')::date
       >= public.audit_floor()
  );

-- 子表串到父表（父表被擋 → 子表 EXISTS 失敗 → 一起隱藏）
drop policy if exists audit_floor_customer_addresses on public.customer_addresses;
create policy audit_floor_customer_addresses on public.customer_addresses as restrictive for select
  using (public.audit_floor() is null
         or exists (select 1 from public.customers c where c.id = customer_addresses.customer_id));

drop policy if exists audit_floor_customer_phones on public.customer_phones;
create policy audit_floor_customer_phones on public.customer_phones as restrictive for select
  using (public.audit_floor() is null
         or exists (select 1 from public.customers c where c.id = customer_phones.customer_id));

drop policy if exists audit_floor_machines on public.machines;
create policy audit_floor_machines on public.machines as restrictive for select
  using (public.audit_floor() is null
         or exists (select 1 from public.customers c where c.id = machines.customer_id));

drop policy if exists audit_floor_order_items on public.order_items;
create policy audit_floor_order_items on public.order_items as restrictive for select
  using (public.audit_floor() is null
         or exists (select 1 from public.orders o where o.id = order_items.order_id));

drop policy if exists audit_floor_order_adjustments on public.order_adjustments;
create policy audit_floor_order_adjustments on public.order_adjustments as restrictive for select
  using (public.audit_floor() is null
         or exists (select 1 from public.orders o where o.id = order_adjustments.order_id));

drop policy if exists audit_floor_order_promotions on public.order_promotions;
create policy audit_floor_order_promotions on public.order_promotions as restrictive for select
  using (public.audit_floor() is null
         or exists (select 1 from public.orders o where o.id = order_promotions.order_id));

-- ---------------------------------------------------------------------------
-- 唯讀寫入封鎖（RESTRICTIVE）：readonly 帳號擋下 insert/update/delete
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'customers','customer_addresses','customer_phones','machines',
    'orders','order_items','order_adjustments','order_promotions'
  ] loop
    execute format('drop policy if exists ro_deny_ins on public.%I', t);
    execute format('create policy ro_deny_ins on public.%I as restrictive for insert with check (not public.is_readonly())', t);
    execute format('drop policy if exists ro_deny_upd on public.%I', t);
    execute format('create policy ro_deny_upd on public.%I as restrictive for update using (not public.is_readonly())', t);
    execute format('drop policy if exists ro_deny_del on public.%I', t);
    execute format('create policy ro_deny_del on public.%I as restrictive for delete using (not public.is_readonly())', t);
  end loop;
end $$;
