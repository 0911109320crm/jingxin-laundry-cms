-- ============================================================================
-- 淨新洗衣 CMS — 0001 Initial Schema
-- ============================================================================
-- Notes:
--   * Supabase auth.users is the source of truth for credentials.
--   * public.user_profiles attaches role/name to each auth user.
--   * RLS is enabled on every table; policies grant access by role.
--   * pg_trgm is used for fuzzy text search (Chinese names/addresses).
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------------
create type public.user_role        as enum ('owner', 'manager', 'technician');
create type public.machine_type     as enum ('washing_machine', 'air_conditioner', 'mattress', 'sofa', 'other');
create type public.adjustment_type  as enum ('discount', 'addon');
create type public.order_status     as enum ('pending', 'scheduled', 'in_progress', 'done', 'cancelled');
create type public.payment_method   as enum ('cash', 'transfer', 'card', 'line_pay', 'unpaid');
create type public.reminder_type    as enum ('annual_due');
create type public.reminder_status  as enum ('pending', 'sent', 'skipped');

-- ---------------------------------------------------------------------------
-- user_profiles (RBAC profile attached to auth.users)
-- ---------------------------------------------------------------------------
create table public.user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  phone       text,
  role        public.user_role not null default 'technician',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_user_profiles_updated
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- helper: current user's role (used in RLS)
create or replace function public.current_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.user_profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- customer_sources (owner-managed master data)
-- ---------------------------------------------------------------------------
create table public.customer_sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.customer_sources (name, sort_order) values
  ('LINE',         1),
  ('Google',       2),
  ('Facebook',     3),
  ('跟車',         4),
  ('關鍵電話',     5),
  ('現場推廣告',   6),
  ('老客介紹',     7);

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  phone       text not null,
  source_id   uuid references public.customer_sources(id) on delete set null,
  note        text,
  joined_at   date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_customers_updated
  before update on public.customers
  for each row execute function public.set_updated_at();

create index idx_customers_phone      on public.customers (phone);
create index idx_customers_code_trgm  on public.customers using gin (code gin_trgm_ops);
create index idx_customers_name_trgm  on public.customers using gin (name gin_trgm_ops);
create index idx_customers_note_trgm  on public.customers using gin (note gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- customer_addresses
-- ---------------------------------------------------------------------------
create table public.customer_addresses (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  county       text not null,
  district     text not null,
  address      text not null,
  label        text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index idx_addresses_customer  on public.customer_addresses (customer_id);
create index idx_addresses_region    on public.customer_addresses (county, district);
create index idx_addresses_trgm      on public.customer_addresses using gin (address gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- machines
-- ---------------------------------------------------------------------------
create table public.machines (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  address_id   uuid references public.customer_addresses(id) on delete set null,
  type         public.machine_type not null,
  brand        text,
  model        text,
  sub_type     text,
  note         text,
  created_at   timestamptz not null default now()
);
create index idx_machines_customer    on public.machines (customer_id);
create index idx_machines_brand_trgm  on public.machines using gin (brand gin_trgm_ops);
create index idx_machines_note_trgm   on public.machines using gin (note gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- service_items (sticker code on the machine)
-- ---------------------------------------------------------------------------
create table public.service_items (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           text not null,
  default_price  numeric(10,2) not null default 0,
  category       text,
  active         boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

insert into public.service_items (code, name, default_price, category, sort_order) values
  ('A', '直立式洗衣機',     1800, 'washing_machine',    1),
  ('B', '滾筒式洗衣機',     3800, 'washing_machine',    2),
  ('C', '分離式冷氣',       2500, 'air_conditioner',    3),
  ('D', '床墊清潔（單）',   2000, 'mattress',           4),
  ('E', '沙發清潔（三人）', 2400, 'sofa',               5);

-- ---------------------------------------------------------------------------
-- adjustment_items
-- ---------------------------------------------------------------------------
create table public.adjustment_items (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            public.adjustment_type not null,
  default_amount  numeric(10,2) not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

insert into public.adjustment_items (name, type, default_amount) values
  ('加大',       'addon',    200),
  ('其他加價',   'addon',    0),
  ('折扣',       'discount', 100);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_code         text not null unique,
  customer_id        uuid not null references public.customers(id) on delete restrict,
  address_id         uuid not null references public.customer_addresses(id) on delete restrict,
  scheduled_at       timestamptz,
  service_at         timestamptz,
  status             public.order_status not null default 'pending',
  payment_method     public.payment_method,
  subtotal           numeric(10,2) not null default 0,
  adjustments_total  numeric(10,2) not null default 0,
  total              numeric(10,2) not null default 0,
  note               text,
  source             text,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_orders_updated
  before update on public.orders
  for each row execute function public.set_updated_at();

create index idx_orders_customer    on public.orders (customer_id);
create index idx_orders_scheduled   on public.orders (scheduled_at);
create index idx_orders_service     on public.orders (service_at);
create index idx_orders_status      on public.orders (status);
create index idx_orders_code_trgm   on public.orders using gin (order_code gin_trgm_ops);
create index idx_orders_note_trgm   on public.orders using gin (note gin_trgm_ops);

-- generate order code "YYYYMMDD-NNN"
create or replace function public.generate_order_code(p_date date default current_date)
returns text language plpgsql as $$
declare
  v_prefix text := to_char(p_date, 'YYYYMMDD');
  v_count  int;
begin
  select coalesce(max(substring(order_code from '\-(\d+)$')::int), 0) + 1
    into v_count
    from public.orders
   where order_code like v_prefix || '-%';
  return v_prefix || '-' || lpad(v_count::text, 3, '0');
end $$;

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  machine_id       uuid references public.machines(id) on delete set null,
  service_item_id  uuid not null references public.service_items(id) on delete restrict,
  technician_id    uuid references public.user_profiles(id) on delete set null,
  quantity         int not null default 1,
  unit_price       numeric(10,2) not null,
  subtotal         numeric(10,2) not null,
  tag              text,
  note             text,
  created_at       timestamptz not null default now()
);
create index idx_items_order       on public.order_items (order_id);
create index idx_items_technician  on public.order_items (technician_id);
create index idx_items_service     on public.order_items (service_item_id);

-- ---------------------------------------------------------------------------
-- order_adjustments
-- ---------------------------------------------------------------------------
create table public.order_adjustments (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders(id) on delete cascade,
  adjustment_item_id   uuid references public.adjustment_items(id) on delete set null,
  name_snapshot        text not null,
  type                 public.adjustment_type not null,
  amount               numeric(10,2) not null,
  note                 text,
  created_at           timestamptz not null default now()
);
create index idx_adjustments_order on public.order_adjustments (order_id);

-- ---------------------------------------------------------------------------
-- order totals trigger: when items or adjustments change, refresh orders.totals
-- ---------------------------------------------------------------------------
create or replace function public.refresh_order_totals(p_order_id uuid)
returns void language plpgsql as $$
declare
  v_subtotal     numeric(10,2);
  v_addon        numeric(10,2);
  v_discount     numeric(10,2);
begin
  select coalesce(sum(subtotal), 0) into v_subtotal
    from public.order_items where order_id = p_order_id;

  select coalesce(sum(case when type = 'addon'    then amount else 0 end), 0),
         coalesce(sum(case when type = 'discount' then amount else 0 end), 0)
    into v_addon, v_discount
    from public.order_adjustments where order_id = p_order_id;

  update public.orders
     set subtotal          = v_subtotal,
         adjustments_total = v_addon - v_discount,
         total             = v_subtotal + v_addon - v_discount
   where id = p_order_id;
end $$;

create or replace function public.trg_refresh_order_totals()
returns trigger language plpgsql as $$
begin
  perform public.refresh_order_totals(coalesce(new.order_id, old.order_id));
  return coalesce(new, old);
end $$;

create trigger trg_items_refresh_totals
  after insert or update or delete on public.order_items
  for each row execute function public.trg_refresh_order_totals();

create trigger trg_adjustments_refresh_totals
  after insert or update or delete on public.order_adjustments
  for each row execute function public.trg_refresh_order_totals();

-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------
create table public.reminders (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  last_order_id   uuid references public.orders(id) on delete set null,
  type            public.reminder_type not null default 'annual_due',
  due_date        date not null,
  status          public.reminder_status not null default 'pending',
  sent_at         timestamptz,
  sent_by         uuid references public.user_profiles(id) on delete set null,
  channel         text,
  note            text,
  created_at      timestamptz not null default now()
);
create index idx_reminders_status on public.reminders (status, due_date);

-- daily job: find customers whose latest service is 11-13 months ago
create or replace function public.refresh_annual_reminders()
returns int language plpgsql security definer as $$
declare
  v_inserted int := 0;
begin
  with last_orders as (
    select distinct on (customer_id) customer_id, id as order_id, service_at
      from public.orders
     where service_at is not null and status = 'done'
     order by customer_id, service_at desc
  )
  insert into public.reminders (customer_id, last_order_id, type, due_date)
  select lo.customer_id, lo.order_id, 'annual_due',
         (lo.service_at::date + interval '1 year')::date
    from last_orders lo
   where lo.service_at::date between (current_date - interval '13 months')
                                 and (current_date - interval '11 months')
     and not exists (
       select 1 from public.reminders r
        where r.customer_id = lo.customer_id
          and r.type = 'annual_due'
          and r.status = 'pending'
     );
  get diagnostics v_inserted = row_count;
  return v_inserted;
end $$;

-- ---------------------------------------------------------------------------
-- import_logs / audit_logs
-- ---------------------------------------------------------------------------
create table public.import_logs (
  id              uuid primary key default gen_random_uuid(),
  file_name       text not null,
  imported_by     uuid references public.user_profiles(id) on delete set null,
  row_count       int not null default 0,
  success_count   int not null default 0,
  fail_count      int not null default 0,
  error_log       jsonb,
  created_at      timestamptz not null default now()
);

create table public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.user_profiles(id) on delete set null,
  action       text not null,
  target_type  text,
  target_id    uuid,
  payload      jsonb,
  created_at   timestamptz not null default now()
);
create index idx_audit_target on public.audit_logs (target_type, target_id);
create index idx_audit_user   on public.audit_logs (user_id, created_at desc);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.user_profiles       enable row level security;
alter table public.customer_sources    enable row level security;
alter table public.customers           enable row level security;
alter table public.customer_addresses  enable row level security;
alter table public.machines            enable row level security;
alter table public.service_items       enable row level security;
alter table public.adjustment_items    enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.order_adjustments   enable row level security;
alter table public.reminders           enable row level security;
alter table public.import_logs         enable row level security;
alter table public.audit_logs          enable row level security;

-- user_profiles: self read; owner can manage all
create policy "profile self read" on public.user_profiles for select
  using (id = auth.uid() or public.current_role() in ('owner', 'manager'));
create policy "profile owner all" on public.user_profiles for all
  using (public.current_role() = 'owner')
  with check (public.current_role() = 'owner');

-- master data (customers, sources, addresses, machines, service_items, adjustment_items)
-- pattern: any auth'd user can SELECT; only owner/manager can WRITE
do $$
declare
  t text;
  tables text[] := array[
    'customer_sources',
    'customers',
    'customer_addresses',
    'machines',
    'service_items',
    'adjustment_items'
  ];
begin
  foreach t in array tables loop
    execute format(
      'create policy "read all auth" on public.%I for select using (auth.uid() is not null)', t
    );
    execute format(
      'create policy "write manager+" on public.%I for all using (public.current_role() in (''owner'',''manager'')) with check (public.current_role() in (''owner'',''manager''))', t
    );
  end loop;
end $$;

-- orders: owner/manager full; technician only orders they have items on
create policy "orders read" on public.orders for select
  using (
    public.current_role() in ('owner', 'manager')
    or exists (
      select 1 from public.order_items oi
       where oi.order_id = orders.id and oi.technician_id = auth.uid()
    )
  );
create policy "orders write manager+" on public.orders for all
  using (public.current_role() in ('owner', 'manager'))
  with check (public.current_role() in ('owner', 'manager'));

-- order_items: owner/manager full; technician can read+update own items
create policy "items read" on public.order_items for select
  using (public.current_role() in ('owner', 'manager') or technician_id = auth.uid());
create policy "items write manager+" on public.order_items for all
  using (public.current_role() in ('owner', 'manager'))
  with check (public.current_role() in ('owner', 'manager'));
create policy "items update own" on public.order_items for update
  using (technician_id = auth.uid())
  with check (technician_id = auth.uid());

-- order_adjustments: same as orders (technician read if they own the order)
create policy "adj read" on public.order_adjustments for select
  using (
    public.current_role() in ('owner', 'manager')
    or exists (
      select 1 from public.order_items oi
       where oi.order_id = order_adjustments.order_id and oi.technician_id = auth.uid()
    )
  );
create policy "adj write manager+" on public.order_adjustments for all
  using (public.current_role() in ('owner', 'manager'))
  with check (public.current_role() in ('owner', 'manager'));

-- reminders / import_logs: manager+
create policy "reminders manager+" on public.reminders for all
  using (public.current_role() in ('owner', 'manager'))
  with check (public.current_role() in ('owner', 'manager'));
create policy "imports manager+" on public.import_logs for all
  using (public.current_role() in ('owner', 'manager'))
  with check (public.current_role() in ('owner', 'manager'));

-- audit_logs: owner reads; anyone authed can insert (system writes)
create policy "audit owner read" on public.audit_logs for select
  using (public.current_role() = 'owner');
create policy "audit insert any auth" on public.audit_logs for insert
  with check (auth.uid() is not null);
