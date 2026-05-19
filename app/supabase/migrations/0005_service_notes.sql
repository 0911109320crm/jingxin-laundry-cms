-- ============================================================================
-- 0005 師傅完成訂單後的快速備註 + 特殊備註
-- ============================================================================
-- service_tag_presets: 老闆娘可管理的「快速備註」標籤清單
--   (例: 洗衣粉、無電梯、有廢水、寵物毛、頂樓加蓋…)
--   標籤以 text 快照存於 orders.service_tags，刪除/改名 preset 不影響舊資料。
-- orders.service_tags:  text[]   勾選的快速備註標籤陣列
-- orders.service_notes: text     師傅自由文字描述本案特殊狀況
-- ============================================================================

create table public.service_tag_presets (
  id          uuid primary key default gen_random_uuid(),
  label       text not null unique,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_service_tag_presets_updated
  before update on public.service_tag_presets
  for each row execute function public.set_updated_at();

alter table public.orders
  add column service_tags  text[] not null default '{}',
  add column service_notes text;

-- 標籤 array 通常筆數少，不另建 GIN index；查詢以 order_id 為主。

-- RLS：任何已登入使用者可讀（師傅完成案件時要載入 picker）；manager/owner 可寫。
alter table public.service_tag_presets enable row level security;
create policy "tag presets read all" on public.service_tag_presets for select
  using (auth.uid() is not null);
create policy "tag presets write manager+" on public.service_tag_presets for all
  using (public.current_role() in ('owner','manager'))
  with check (public.current_role() in ('owner','manager'));

-- 預設一些常見項目，老闆娘可自行調整 / 停用
insert into public.service_tag_presets (label, sort_order) values
  ('洗衣粉',     10),
  ('無電梯',     20),
  ('有廢水',     30),
  ('寵物毛',     40),
  ('頂樓加蓋',   50),
  ('需脫鞋',     60),
  ('狹小空間',   70);
