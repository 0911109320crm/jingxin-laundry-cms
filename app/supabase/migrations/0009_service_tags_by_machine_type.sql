-- ============================================================================
-- 0009 服務標籤按機型分組
-- ============================================================================
-- 老闆娘 2026-05-21 提供 4 組按機型細分的問題標籤（總計 ~52 個）：
--   直立式洗衣機 / 滾筒洗衣機 / 冷氣 / 床墊沙發
--
-- 0005 原本是全域共用 7 個標籤，現在加 category 欄位區分機型。
-- 砍舊 seed 重來；orders.service_tags 是 text[] 快照，舊資料不受影響。
--
-- UI fallback 規則（程式邏輯處理，不在 schema 層）：
--   ac_hidden 機型 → 載入 category='ac_hidden' OR 'ac_split' 的標籤
--   sofa     機型 → 載入 category='sofa'      OR 'mattress' 的標籤
--   （目前 seed 只放 ac_split 與 mattress，共用即可）
-- ============================================================================

-- 1) 加 category 欄位
alter table public.service_tag_presets
  add column category text;

-- 2) 拿掉原本全域 label unique（同名標籤現在可跨分類存在）
alter table public.service_tag_presets
  drop constraint service_tag_presets_label_key;

-- 3) 改成 (category, label) 唯一
alter table public.service_tag_presets
  add constraint uniq_service_tag_presets_category_label unique (category, label);

create index idx_service_tag_presets_category
  on public.service_tag_presets (category, sort_order)
  where active = true;

-- 4) 砍舊 seed 重來
truncate table public.service_tag_presets;

-- ---------------------------------------------------------------------------
-- Seed: 4 組標籤（共 ~52 個）
-- ---------------------------------------------------------------------------
insert into public.service_tag_presets (category, label, sort_order) values
  -- 直立式洗衣機（14）
  ('washing_vertical', '洗衣粉',     10),
  ('washing_vertical', '柔香球',     20),
  ('washing_vertical', '地下水',     30),
  ('washing_vertical', '很髒',       40),
  ('washing_vertical', '髒污硬化',   50),
  ('washing_vertical', '鏽蝕滑牙',   60),
  ('washing_vertical', '卡盤',       70),
  ('washing_vertical', '有異音',     80),
  ('washing_vertical', '軸心異常',   90),
  ('washing_vertical', '晃動大',    100),
  ('washing_vertical', '5年內',     110),
  ('washing_vertical', '10年以上',  120),
  ('washing_vertical', '有樓層',    130),
  ('washing_vertical', '其他(備註)',140),
  -- 滾筒洗衣機（14）
  ('washing_drum', '洗衣粉',     10),
  ('washing_drum', '柔香球',     20),
  ('washing_drum', '地下水',     30),
  ('washing_drum', '很髒',       40),
  ('washing_drum', '髒污硬化',   50),
  ('washing_drum', '鏽蝕滑牙',   60),
  ('washing_drum', '破膠圈',     70),
  ('washing_drum', '斷螺母',     80),
  ('washing_drum', '軸承異音',   90),
  ('washing_drum', '電腦異常',  100),
  ('washing_drum', '5年內',     110),
  ('washing_drum', '10年以上',  120),
  ('washing_drum', '有樓層',    130),
  ('washing_drum', '其他(備註)',140),
  -- 冷氣（分離式 + 吊隱式共用）— 12
  ('ac_split', '無法拆風鼓',   10),
  ('ac_split', '一體式集水盤', 20),
  ('ac_split', '冷度不足',     30),
  ('ac_split', '排水管堵塞',   40),
  ('ac_split', '漏水',         50),
  ('ac_split', '軸承異音',     60),
  ('ac_split', '百葉異音',     70),
  ('ac_split', '馬達異音',     80),
  ('ac_split', '5年內',        90),
  ('ac_split', '10年以上',    100),
  ('ac_split', '有樓層',      110),
  ('ac_split', '其他(備註)',  120),
  -- 床墊 + 沙發共用（髒污問題）— 12
  ('mattress', '一般髒污',   10),
  ('mattress', '尿漬',       20),
  ('mattress', '血漬',       30),
  ('mattress', '嘔吐',       40),
  ('mattress', '汗漬',       50),
  ('mattress', '兒童塗鴉',   60),
  ('mattress', '飲品打翻',   70),
  ('mattress', '寵物尿',     80),
  ('mattress', '寵物吐',     90),
  ('mattress', '發霉',      100),
  ('mattress', '異味問題',  110),
  ('mattress', '其他(備註)',120);
