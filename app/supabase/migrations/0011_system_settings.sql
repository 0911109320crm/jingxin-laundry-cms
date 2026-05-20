-- ============================================================================
-- 0011 系統設定表 + customer_sources 細化
-- ============================================================================
-- 1) system_settings: 通用 key/value 設定（jsonb 值）
--    目前用途：師傅每月促銷積分 KPI 目標（預設 3，老闆可在後台調）
-- 2) 新增「FB 地方社團」來源（老闆娘想分析地方社團 vs 一般 FB 的成效差異）
-- ============================================================================

-- ---------------------------------------------------------------------------
-- system_settings
-- ---------------------------------------------------------------------------
create table public.system_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);
create trigger trg_system_settings_updated
  before update on public.system_settings
  for each row execute function public.set_updated_at();

alter table public.system_settings enable row level security;
create policy "settings read all auth" on public.system_settings for select
  using (auth.uid() is not null);
create policy "settings write owner" on public.system_settings for all
  using (public.current_role() = 'owner')
  with check (public.current_role() = 'owner');

insert into public.system_settings (key, value, description) values
  ('monthly_promotion_kpi',
   '3'::jsonb,
   '師傅每月促銷積分 KPI 目標（達標換色顯示）');

-- ---------------------------------------------------------------------------
-- customer_sources 細化
-- ---------------------------------------------------------------------------
insert into public.customer_sources (name, sort_order) values
  ('FB 地方社團', 8);
