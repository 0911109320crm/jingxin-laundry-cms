-- ============================================================================
-- 0022 雙槽式 category + 老闆娘基本價清單 v2
-- ============================================================================
-- 老闆娘 2026-05-26 確認最終版基本價：
--   直立式 1800 起、雙槽式 1300、滾筒式 4000
--   分離式 2500、吊隱式 3200
--   沙發清洗 1800 起、床墊除蟎 1300、床墊清洗 1800
--
-- 設計原則（feedback_owner_ui_minimal）：
--   - 老闆娘建單只看到 8 個基本價按鈕，不接觸 service_item code
--   - 後台 service_items 管理頁是老闆娘的「主控台」，可改價/啟停/標 basic_choice
--   - 師傅 PWA 看完整尺寸表 service_items 換實際品項
--
-- 變動：
--   1. 新增 washing_twin_tub 為標準 category（service_items / machine_brands）
--   2. 加 WTUB（雙槽式洗衣機，1300，basic_choice）— 註：避開已被 LG Wash Tower 用的 WT-1
--   3. 雙槽常見品牌 seed（5 個老闆會接到的老款品牌）
--   4. SF-80 不再為 basic_choice → 改 SF-100 為 basic（1800 起）
--   5. AH-S 預設價 2500 → 3200（吊隱式起價，老闆娘確認）
--   6. BW-S 加為 basic_choice（床墊清洗單人 1800）
--   7. is_basic_choice comment 更新：放寬為「每個 category 至少 1 項」（不再限 1 項）
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) 新增 washing_twin_tub category — service_item
-- ---------------------------------------------------------------------------
insert into public.service_items (code, name, default_price, category, sort_order, active, is_basic_choice)
values ('WTUB', '雙槽式洗衣機', 1300, 'washing_twin_tub', 60, true, true)
on conflict (code) do update set
  name             = excluded.name,
  default_price    = excluded.default_price,
  category         = excluded.category,
  sort_order       = excluded.sort_order,
  active           = true,
  is_basic_choice  = true;

-- ---------------------------------------------------------------------------
-- 2) 雙槽常見品牌 seed（老款半自動洗衣機常見品牌）
-- ---------------------------------------------------------------------------
insert into public.machine_brands (category, name, sort_order) values
  ('washing_twin_tub', '三洋',   10),
  ('washing_twin_tub', '聲寶',   20),
  ('washing_twin_tub', '東元',   30),
  ('washing_twin_tub', '大同',   40),
  ('washing_twin_tub', '國際牌', 50)
on conflict (category, name) do nothing;

-- ---------------------------------------------------------------------------
-- 3) is_basic_choice 重新標記
--    放寬規則：每 category 可標多項（床墊就有除蟎 + 清洗 2 條）
-- ---------------------------------------------------------------------------

-- 先全部歸零（保留 WTUB 因為剛剛插入時就標好了）
update public.service_items
   set is_basic_choice = false
 where code <> 'WTUB';

-- 重新標 basic_choice（含 WTUB 已在上方標記，這裡再 safety 補一次）
update public.service_items
   set is_basic_choice = true
 where code in (
   'WV-S',    -- 直立式洗衣機 3-17公斤 1800
   'WTUB',    -- 雙槽式洗衣機 1300
   'WD-L1',   -- 滾筒洗衣機 LG/國際/日立 17公斤內 4000
   'SF-100',  -- 布沙發 一字型 81-100cm 1800
   'BD-S',    -- 床墊除塵蟎 單人 1300
   'BW-S',    -- 床墊清洗 單人 1800
   'AC-S',    -- 分離式冷氣 60以下 2500
   'AH-S'     -- 吊隱式冷氣 60以下（改價 3200，見下方）
 );

-- ---------------------------------------------------------------------------
-- 4) 吊隱式冷氣 AH-S 預設價 2500 → 3200（老闆娘 2026-05-26 確認）
--    注意：只改 AH-S（老闆娘建單看到的基本價）。
--    AH-M / AH-L / AHX-S / AHX-M 維持原價，老闆娘可在後台自己調整。
-- ---------------------------------------------------------------------------
update public.service_items
   set default_price = 3200,
       name = '吊隱式冷氣'   -- 不再標尺寸，老闆娘端只看「吊隱式冷氣 3200」
 where code = 'AH-S';

-- ---------------------------------------------------------------------------
-- 5) Comment 更新
-- ---------------------------------------------------------------------------
comment on column public.service_items.is_basic_choice is
  '老闆娘建單下拉是否顯示此項（每 category 至少 1 項；床墊可同時標除蟎+清洗 2 項）。'
  '師傅 PWA 換實際品項時不過濾 is_basic_choice，看完整尺寸表。';
