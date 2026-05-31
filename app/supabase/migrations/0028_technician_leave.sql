-- ============================================================================
-- 0028 師傅休假（給「月曆派案總覽頁」的全日/上午/下午休）
-- ============================================================================
-- 老闆娘 2026-05-31 需求：在月曆頁可快速設定師傅每天的休假。
--   period: full=全日休、am=上午休、pm=下午休
--   按鈕顯示邏輯(前端)：當天該師傅上午已派案→只能設 pm；下午已派案→只能設 am；
--   都沒派案→三種都可設。資料層不強制，由 UI 控制 + owner/manager 可覆寫。
-- ============================================================================

create table if not exists public.technician_leave (
  id             uuid primary key default gen_random_uuid(),
  technician_id  uuid not null references public.user_profiles(id) on delete cascade,
  leave_date     date not null,
  period         text not null check (period in ('full', 'am', 'pm')),
  note           text,
  created_by     uuid references public.user_profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  -- 同一師傅同一天同一時段只會有一筆；full 與 am/pm 的互斥由應用層處理
  unique (technician_id, leave_date, period)
);

create index if not exists idx_tech_leave_date
  on public.technician_leave (leave_date);
create index if not exists idx_tech_leave_tech_date
  on public.technician_leave (technician_id, leave_date);

alter table public.technician_leave enable row level security;

-- owner / manager：全權
drop policy if exists tech_leave_admin_all on public.technician_leave;
create policy tech_leave_admin_all on public.technician_leave
  for all
  using (exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role in ('owner', 'manager')
  ))
  with check (exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role in ('owner', 'manager')
  ));

-- technician：只能讀自己的休假
drop policy if exists tech_leave_self_read on public.technician_leave;
create policy tech_leave_self_read on public.technician_leave
  for select
  using (technician_id = auth.uid());

comment on table public.technician_leave is
  '師傅休假（月曆頁設定）。period: full/am/pm。owner/manager 可增刪改，師傅唯讀自己的。';
