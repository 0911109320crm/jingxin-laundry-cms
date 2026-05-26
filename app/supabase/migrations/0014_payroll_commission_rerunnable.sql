-- ============================================================================
-- 0014 薪資抽成系統（rerunnable 版 — 部分跑過後可重跑）
-- ============================================================================
-- 跟原 0014_payroll_commission.sql 邏輯完全一樣，只是改用 idempotent 寫法：
--   - create table → if not exists
--   - create index → if not exists
--   - create policy → drop if exists → create
-- 用來修正之前 0014 部分執行後撞 "already exists" 的情況。
-- ============================================================================

-- 1) service_items: 抽成欄位（已是 idempotent）
alter table public.service_items
  add column if not exists commission_type text
    check (commission_type in ('percent', 'amount', 'default'))
    not null default 'default',
  add column if not exists commission_value numeric(10, 2)
    not null default 0;

comment on column public.service_items.commission_type is
  '抽成方式：percent=百分比、amount=固定金額/件、default=套用全店預設值';
comment on column public.service_items.commission_value is
  '抽成數值。type=percent 時為 0-100；type=amount 時為元/件；type=default 時忽略';

-- 2) adjustment_items: 是否進師傅薪資（已是 idempotent）
alter table public.adjustment_items
  add column if not exists affects_commission boolean not null default true;

comment on column public.adjustment_items.affects_commission is
  '此加減項是否進師傅薪資。加大/拆壞=true（多做的工），節慶折扣=false（店家行銷成本）';

update public.adjustment_items set affects_commission = false where name = '折扣';

-- 3) payroll_adjustments
create table if not exists public.payroll_adjustments (
  id              uuid primary key default gen_random_uuid(),
  technician_id   uuid not null references public.user_profiles(id) on delete cascade,
  month           text not null,
  type            text not null check (type in ('bonus', 'deduction')),
  amount          numeric(10, 2) not null check (amount >= 0),
  reason          text not null,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);

create index if not exists idx_payroll_adjustments_tech_month
  on public.payroll_adjustments(technician_id, month);

alter table public.payroll_adjustments enable row level security;
drop policy if exists "payroll_adj read auth" on public.payroll_adjustments;
create policy "payroll_adj read auth" on public.payroll_adjustments for select
  using (auth.uid() is not null);
drop policy if exists "payroll_adj write manager+" on public.payroll_adjustments;
create policy "payroll_adj write manager+" on public.payroll_adjustments for all
  using (public.current_role() in ('owner', 'manager'))
  with check (public.current_role() in ('owner', 'manager'));

comment on table public.payroll_adjustments is
  '月度獎勵 / 扣款。老闆娘月底進師傅薪資詳細頁手動加減。';

-- 4) payroll_snapshots
create table if not exists public.payroll_snapshots (
  id              uuid primary key default gen_random_uuid(),
  technician_id   uuid not null references public.user_profiles(id) on delete cascade,
  month           text not null,
  net_amount      numeric(12, 2) not null,
  breakdown       jsonb not null,
  finalized_at    timestamptz not null default now(),
  finalized_by    uuid references auth.users(id) on delete set null,
  unique (technician_id, month)
);

create index if not exists idx_payroll_snapshots_month on public.payroll_snapshots(month);

alter table public.payroll_snapshots enable row level security;
drop policy if exists "payroll_snap read auth" on public.payroll_snapshots;
create policy "payroll_snap read auth" on public.payroll_snapshots for select
  using (auth.uid() is not null);
drop policy if exists "payroll_snap write owner" on public.payroll_snapshots;
create policy "payroll_snap write owner" on public.payroll_snapshots for all
  using (public.current_role() = 'owner')
  with check (public.current_role() = 'owner');

comment on table public.payroll_snapshots is
  '月結 snapshot。月底結算時把當下計算結果寫進來，之後改設定不影響歷史。';

-- 5) system_settings（已是 idempotent）
insert into public.system_settings (key, value, description) values
  ('default_commission_type',
   '"percent"'::jsonb,
   '預設抽成方式（service_items.commission_type=default 時套用）：percent 或 amount'),
  ('default_commission_value',
   '60'::jsonb,
   '預設抽成數值：percent 時 0-100、amount 時元/件'),
  ('payroll_kpi_disclaimer',
   '"薪資 = Σ(每件抽成) + Σ(進薪資的加價) − Σ(進薪資的折扣) + Σ(本月獎勵) − Σ(本月扣款)"'::jsonb,
   '薪資公式說明，顯示在薪資設定頁讓老闆娘理解')
on conflict (key) do nothing;
