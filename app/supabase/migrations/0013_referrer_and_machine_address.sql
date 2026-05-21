-- 0013 customer referrer + machine address (UI hookup)
--
-- 1. customers.referrer_id：標記「誰介紹這位客戶來的」，FK 指回 customers
-- 2. machines.address_id 已存在於 0001_initial_schema.sql line 122，
--    但 UI 從未綁定。本 migration 不改 machines schema，
--    只補上一個顯式索引（FK 通常會自動建，補強）。

alter table public.customers
  add column if not exists referrer_id uuid
    references public.customers(id) on delete set null;

create index if not exists idx_customers_referrer_id
  on public.customers(referrer_id);

create index if not exists idx_machines_address_id
  on public.machines(address_id);
