-- ============================================================================
-- 0007 機型品牌主檔
-- ============================================================================
-- 取代原 machines.brand free text 輸入：師傅在 PWA 用下拉選單選品牌。
-- 老闆娘可在 /settings/machine-brands 增刪/啟停每個分類下的品牌。
--
-- category 標準值（同時用於 service_tag_presets / service_items.machine_category）：
--   washing_vertical  直立式洗衣機
--   washing_drum      滾筒洗衣機
--   ac_split          分離式冷氣
--   ac_hidden         吊隱式冷氣
--   mattress          床墊
--   sofa              沙發
--
-- 已剔除老闆娘 ❌ 劃掉：Miele（直立/滾筒）、Carrier/York/Trane/McQuay（吊隱式）。
-- ============================================================================

create table public.machine_brands (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  name        text not null,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (category, name)
);

create index idx_machine_brands_category
  on public.machine_brands (category, sort_order)
  where active = true;

alter table public.machine_brands enable row level security;
create policy "brands read all" on public.machine_brands for select
  using (auth.uid() is not null);
create policy "brands write manager+" on public.machine_brands for all
  using (public.current_role() in ('owner','manager'))
  with check (public.current_role() in ('owner','manager'));

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------
insert into public.machine_brands (category, name, sort_order) values
  -- 直立式洗衣機（15）
  ('washing_vertical', 'Panasonic',   10),
  ('washing_vertical', 'HITACHI',     20),
  ('washing_vertical', 'TOSHIBA',     30),
  ('washing_vertical', 'SHARP',       40),
  ('washing_vertical', 'LG',          50),
  ('washing_vertical', 'SAMSUNG',     60),
  ('washing_vertical', 'SAMPO',       70),
  ('washing_vertical', 'TECO',        80),
  ('washing_vertical', 'HERAN',       90),
  ('washing_vertical', 'SANLUX',     100),
  ('washing_vertical', 'TATUNG',     110),
  ('washing_vertical', 'CHIMEI',     120),
  ('washing_vertical', 'Whirlpool',  130),
  ('washing_vertical', 'BOSCH',      140),
  ('washing_vertical', 'Electrolux', 150),
  -- 滾筒洗衣機（11）
  ('washing_drum', 'LG',          10),
  ('washing_drum', 'Panasonic',   20),
  ('washing_drum', 'HITACHI',     30),
  ('washing_drum', 'SAMSUNG',     40),
  ('washing_drum', 'TOSHIBA',     50),
  ('washing_drum', 'Whirlpool',   60),
  ('washing_drum', 'BOSCH',       70),
  ('washing_drum', 'Electrolux',  80),
  ('washing_drum', 'HERAN',       90),
  ('washing_drum', 'SANLUX',     100),
  ('washing_drum', 'TECO',       110),
  -- 分離式冷氣（16）
  ('ac_split', 'DAIKIN',                       10),
  ('ac_split', 'Panasonic',                    20),
  ('ac_split', 'HITACHI',                      30),
  ('ac_split', 'Mitsubishi Heavy Industries',  40),
  ('ac_split', 'Mitsubishi Electric',          50),
  ('ac_split', 'FUJITSU',                      60),
  ('ac_split', 'TOSHIBA',                      70),
  ('ac_split', 'SHARP',                        80),
  ('ac_split', 'LG',                           90),
  ('ac_split', 'SAMSUNG',                     100),
  ('ac_split', 'TECO',                        110),
  ('ac_split', 'HERAN',                       120),
  ('ac_split', 'SAMPO',                       130),
  ('ac_split', 'SANLUX',                      140),
  ('ac_split', 'CHIMEI',                      150),
  ('ac_split', 'TATUNG',                      160),
  -- 吊隱式冷氣（9 — 工程品牌劃掉）
  ('ac_hidden', 'DAIKIN',                      10),
  ('ac_hidden', 'Panasonic',                   20),
  ('ac_hidden', 'HITACHI',                     30),
  ('ac_hidden', 'Mitsubishi Heavy Industries', 40),
  ('ac_hidden', 'Mitsubishi Electric',         50),
  ('ac_hidden', 'FUJITSU',                     60),
  ('ac_hidden', 'TECO',                        70),
  ('ac_hidden', 'HERAN',                       80),
  ('ac_hidden', 'SAMPO',                       90);
