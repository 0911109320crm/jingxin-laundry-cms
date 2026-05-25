-- ============================================================================
-- 0018 舊系統清洗編號 + 訂單明細自動編號 + 未知/待補選項
-- ============================================================================
-- 動機（2026-05-24 老闆娘新需求）：
--
-- 1. 舊系統清洗編號保留供查詢：老客戶回電會報「113A-C103」「115-EA247」這種
--    舊編碼，要能快速 search 找到對應訂單。但新訂單一律不再用舊邏輯。
--    → 加 orders.legacy_code text 欄位 + gin_trgm 模糊搜尋索引
--
-- 2. 多機器訂單師傅貼貼紙需要每台一個編號（避免師傅憑記憶亂編造成重號）：
--    訂單 20260523-006 含 4 台 → 自動產 20260523-006-1, -2, -3, -4
--    → 加 order_items.item_code text + insert trigger 自動填號
--
-- 3. 建單時可能不知道機器廠牌型號：
--    → machine_brands 每個 category 加「(未知)」品牌
--    → service_items 加 6 個「(待補)」項目（每個機型一個）
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) orders.legacy_code
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists legacy_code text;

create index if not exists idx_orders_legacy_code_trgm
  on public.orders using gin (legacy_code gin_trgm_ops);

comment on column public.orders.legacy_code is
  '舊系統清洗編號（如 113A-C103、115-EA247）。僅供老客戶回電查詢用，新訂單為 NULL。';

-- ---------------------------------------------------------------------------
-- 2) order_items.item_code + 自動編號 trigger
-- ---------------------------------------------------------------------------
alter table public.order_items
  add column if not exists item_code text;

create index if not exists idx_order_items_item_code
  on public.order_items (item_code);

comment on column public.order_items.item_code is
  '機器明細編號（如 20260523-006-1, -2）。INSERT 時 trigger 自動產生，師傅貼貼紙照抄。';

-- INSERT 時：item_code 若為 null，自動填 = orders.order_code + '-' + 流水號
create or replace function public.assign_order_item_code()
returns trigger language plpgsql as $$
declare
  v_order_code text;
  v_max_seq int;
begin
  if NEW.item_code is null or NEW.item_code = '' then
    select order_code into v_order_code
      from public.orders where id = NEW.order_id;
    if v_order_code is null then
      return NEW;
    end if;
    -- 從現有 item_code 抽尾巴流水號最大值
    select coalesce(max(substring(item_code from '\-(\d+)$')::int), 0)
      into v_max_seq
      from public.order_items
     where order_id = NEW.order_id
       and item_code is not null
       and item_code ~ '\-\d+$';
    NEW.item_code = v_order_code || '-' || (v_max_seq + 1);
  end if;
  return NEW;
end $$;

drop trigger if exists trg_assign_order_item_code on public.order_items;
create trigger trg_assign_order_item_code
  before insert on public.order_items
  for each row execute function public.assign_order_item_code();

-- ---------------------------------------------------------------------------
-- 3) 補既有 order_items 的 item_code（沒值的補上）
-- ---------------------------------------------------------------------------
do $$
declare
  o record;
  i record;
  seq int;
begin
  for o in
    select id, order_code from public.orders
     where exists (
       select 1 from public.order_items oi
        where oi.order_id = orders.id and (oi.item_code is null or oi.item_code = '')
     )
  loop
    seq := 0;
    for i in
      select id from public.order_items
       where order_id = o.id
       order by created_at, id
    loop
      seq := seq + 1;
      update public.order_items
         set item_code = o.order_code || '-' || seq
       where id = i.id;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4) machine_brands 每個 category 加「(未知)」
-- ---------------------------------------------------------------------------
insert into public.machine_brands (category, name, sort_order) values
  ('washing_vertical', '(未知)', 99990),
  ('washing_drum',     '(未知)', 99990),
  ('ac_split',         '(未知)', 99990),
  ('ac_hidden',        '(未知)', 99990),
  ('mattress',         '(未知)', 99990),
  ('sofa',             '(未知)', 99990)
on conflict (category, name) do nothing;

-- ---------------------------------------------------------------------------
-- 5) service_items 加「(待補)」項目
--    給建單時還不確定機型容量的 case 用，價格 0，老闆娘事後改
-- ---------------------------------------------------------------------------
insert into public.service_items (code, name, default_price, category, sort_order, active) values
  ('TBD-WV', '(待補) 直立洗衣機', 0, 'washing_vertical', 99990, true),
  ('TBD-WD', '(待補) 滾筒洗衣機', 0, 'washing_drum',     99991, true),
  ('TBD-AC', '(待補) 分離式冷氣', 0, 'ac_split',         99992, true),
  ('TBD-AH', '(待補) 吊隱式冷氣', 0, 'ac_hidden',        99993, true),
  ('TBD-BD', '(待補) 床墊',       0, 'mattress',         99994, true),
  ('TBD-SF', '(待補) 沙發',       0, 'sofa',             99995, true)
on conflict (code) do nothing;
