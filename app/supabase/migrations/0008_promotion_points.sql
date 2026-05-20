-- ============================================================================
-- 0008 促銷積分系統（取代 0006 的單一 boolean got_5star_review）
-- ============================================================================
-- 老闆娘 2026-05-21 提出新需求：
--   一張訂單可記錄客戶做了多種促銷動作（FB按讚/評論、Google五星等），
--   每種動作有對應分數，加總後計入師傅本月 KPI。
--
-- 新設計：
--   promotion_types  — 9 種促銷類型主檔（後台可改）
--   order_promotions — 訂單 ↔ 促銷類型 多對一表（含歸屬師傅 + 分數快照）
--
-- 砍掉 0006 的 orders.got_5star_review / reviewed_at / review_credited_to。
-- demo 階段資料量小，不做 data migration。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 移除 0006 加的欄位
-- ---------------------------------------------------------------------------
drop index if exists public.idx_orders_review_credited;

alter table public.orders
  drop column if exists got_5star_review,
  drop column if exists reviewed_at,
  drop column if exists review_credited_to;

-- ---------------------------------------------------------------------------
-- promotion_types
-- ---------------------------------------------------------------------------
create table public.promotion_types (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  label       text not null,
  points      int  not null default 1,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_promotion_types_updated
  before update on public.promotion_types
  for each row execute function public.set_updated_at();

alter table public.promotion_types enable row level security;
create policy "promo types read all" on public.promotion_types for select
  using (auth.uid() is not null);
create policy "promo types write manager+" on public.promotion_types for all
  using (public.current_role() in ('owner','manager'))
  with check (public.current_role() in ('owner','manager'));

insert into public.promotion_types (code, label, points, sort_order) values
  ('fb_like_jingxin',         '淨新粉專按讚',                1, 10),
  ('fb_comment_jingxin',      '淨新粉專評論',                1, 20),
  ('fb_checkin_jingxin',      'FB打卡標記淨新',              1, 30),
  ('fb_checkin_jingxin_tag2', 'FB打卡標記淨新加標記2位朋友', 2, 40),
  ('fb_like_jielixin',        '潔立新粉專按讚',              2, 50),
  ('fb_comment_jielixin',     '潔立新粉專評論',              1, 60),
  ('google_5star',            'Google 五星',                 1, 70),
  ('google_5star_photo',      'Google 五星加照片',           2, 80),
  ('local_group_post',        '地方社團發文標記',            2, 90);

-- ---------------------------------------------------------------------------
-- order_promotions
-- ---------------------------------------------------------------------------
create table public.order_promotions (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  promotion_type_id  uuid not null references public.promotion_types(id) on delete restrict,
  credited_to        uuid references public.user_profiles(id) on delete set null,
  points_snapshot    int  not null,
  note               text,
  created_at         timestamptz not null default now(),
  unique (order_id, promotion_type_id)
);
create index idx_order_promotions_order   on public.order_promotions (order_id);
create index idx_order_promotions_credit  on public.order_promotions (credited_to, created_at desc);

alter table public.order_promotions enable row level security;

-- 讀：owner/manager 全讀；師傅可讀「自己被歸屬」或「自己接的訂單」
create policy "order promo read" on public.order_promotions for select
  using (
    public.current_role() in ('owner', 'manager')
    or credited_to = auth.uid()
    or exists (
      select 1 from public.order_items oi
       where oi.order_id = order_promotions.order_id
         and oi.technician_id = auth.uid()
    )
  );

-- 寫：owner/manager 全權；師傅可自己標 / 自己刪自己的紀錄
create policy "order promo write manager+" on public.order_promotions for all
  using (public.current_role() in ('owner', 'manager'))
  with check (public.current_role() in ('owner', 'manager'));

create policy "order promo insert technician self" on public.order_promotions for insert
  with check (
    credited_to = auth.uid()
    and exists (
      select 1 from public.order_items oi
       where oi.order_id = order_promotions.order_id
         and oi.technician_id = auth.uid()
    )
  );

create policy "order promo delete technician self" on public.order_promotions for delete
  using (
    credited_to = auth.uid()
    and exists (
      select 1 from public.order_items oi
       where oi.order_id = order_promotions.order_id
         and oi.technician_id = auth.uid()
    )
  );
