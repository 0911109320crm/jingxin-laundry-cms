-- 0039: (1) 老闆娘個人行事曆 calendar_notes  (2) 師傅代墊支出 technician_expenses
--
-- 背景：
--  - calendar_notes：老闆娘要一個能在月曆格子裡「直接打字」記雜事的行事曆(汽車保養、保險繳費…)。
--    刻意極簡：一個 (user_id, note_date) 一筆多行文字，不做時間段/分類。加 user_id 供未來多人各自用。
--  - technician_expenses：師傅當天收現後，過程中代墊的支出(加油、停車費…)。讓老闆娘在「待回繳」
--    頁該師傅卡片手動登記，使「收款−代墊=實際繳回現金」對得起來；並計入營業報表成本。

-- ── (1) 個人行事曆 ──────────────────────────────────────────────────────
create table if not exists public.calendar_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.user_profiles(id) on delete cascade,
  note_date   date not null,
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- 一人一天一筆(多件事打多行)；要改成一天多筆時移除此 unique 即可
  unique (user_id, note_date)
);
create index if not exists idx_calendar_notes_user_date
  on public.calendar_notes (user_id, note_date);

alter table public.calendar_notes enable row level security;

-- 只有本人能讀寫自己的行事曆(owner/manager 也只看自己的，這是個人行事曆)
drop policy if exists calendar_notes_self on public.calendar_notes;
create policy calendar_notes_self on public.calendar_notes
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.calendar_notes is
  '個人行事曆雜事筆記。一人一天一筆多行文字。RLS：只能存取自己的。';

-- ── (2) 師傅代墊支出 ────────────────────────────────────────────────────
create table if not exists public.technician_expenses (
  id             uuid primary key default gen_random_uuid(),
  technician_id  uuid not null references public.user_profiles(id) on delete cascade,
  expense_date   date not null default current_date,
  name           text not null,
  amount         numeric(10,2) not null check (amount >= 0),
  -- 是否已沖銷(老闆娘已用回繳現金抵掉這筆代墊)；待回繳卡片只扣未沖銷的
  is_reimbursed  boolean not null default false,
  reimbursed_at  timestamptz,
  note           text,
  created_by     uuid references public.user_profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_tech_expenses_tech
  on public.technician_expenses (technician_id);
create index if not exists idx_tech_expenses_date
  on public.technician_expenses (expense_date);

alter table public.technician_expenses enable row level security;

-- owner / manager 全權；師傅唯讀自己的(報表/個人查詢用)
drop policy if exists tech_expenses_admin_all on public.technician_expenses;
create policy tech_expenses_admin_all on public.technician_expenses
  for all
  using (exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role in ('owner', 'manager')
  ))
  with check (exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role in ('owner', 'manager')
  ));

drop policy if exists tech_expenses_self_read on public.technician_expenses;
create policy tech_expenses_self_read on public.technician_expenses
  for select
  using (technician_id = auth.uid());

comment on table public.technician_expenses is
  '師傅代墊支出(加油/停車等)。老闆娘在待回繳頁登記，沖銷後不再從應繳扣抵；依 expense_date 計入報表成本。';
