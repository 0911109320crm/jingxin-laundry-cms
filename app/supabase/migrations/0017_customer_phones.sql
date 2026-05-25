-- ============================================================================
-- 0017 customer_phones — 多支電話子表
-- ============================================================================
-- 動機：舊資料約 8% 客戶有 2~3 支電話（行動 + 室話 / 本人 + 老公 / 公司）。
-- 原 customers.phone 單欄位裝不下，把副電話寫進 note 不可搜尋。
--
-- 設計：
--   * customers.phone 保留為「主要顯示電話」（向後相容，全部 read 不必改）
--   * customer_phones 子表存所有電話（含主電話，is_primary=true）
--   * trigger 保證每客戶最多 1 個 primary，且自動把 primary 同步進 customers.phone
--   * label 用來標註：本人、老公、家用、公司、表妹、... （free text）
--
-- 搜尋：客戶清單的電話模糊搜尋之後改成 join customer_phones（gin_trgm）。
-- ============================================================================

create table public.customer_phones (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  phone        text not null,
  label        text,
  is_primary   boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create unique index uq_customer_phone
  on public.customer_phones (customer_id, phone);
create index idx_customer_phones_customer
  on public.customer_phones (customer_id);
create index idx_customer_phones_phone_trgm
  on public.customer_phones using gin (phone gin_trgm_ops);
-- 每客戶最多 1 個 primary
create unique index uq_customer_one_primary
  on public.customer_phones (customer_id)
  where is_primary;

-- ---------------------------------------------------------------------------
-- Backfill：把既有 customers.phone 灌進 customer_phones
-- ---------------------------------------------------------------------------
insert into public.customer_phones (customer_id, phone, is_primary, sort_order)
  select id, phone, true, 0
    from public.customers
   where phone is not null and trim(phone) <> ''
on conflict (customer_id, phone) do nothing;

-- ---------------------------------------------------------------------------
-- Trigger：is_primary=true 自動同步到 customers.phone
-- ---------------------------------------------------------------------------
create or replace function public.sync_primary_phone()
returns trigger language plpgsql as $$
begin
  if NEW.is_primary then
    update public.customers
       set phone = NEW.phone
     where id = NEW.customer_id;
  end if;
  return NEW;
end $$;

create trigger trg_sync_primary_phone
  after insert or update of phone, is_primary on public.customer_phones
  for each row
  when (NEW.is_primary)
  execute function public.sync_primary_phone();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.customer_phones enable row level security;
create policy "phones read all auth" on public.customer_phones for select
  using (auth.uid() is not null);
create policy "phones write manager+" on public.customer_phones for all
  using (public.current_role() in ('owner','manager'))
  with check (public.current_role() in ('owner','manager'));
