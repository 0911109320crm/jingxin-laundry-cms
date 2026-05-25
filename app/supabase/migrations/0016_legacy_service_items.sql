-- ============================================================================
-- 0016 舊資料 - 通用 service_items
-- ============================================================================
-- 5 個通用品項用於匯入 2016~2023 的歷史訂單。
-- 舊資料只有「廠牌+金額」，沒有對應到新價目表 0010_real_pricing.sql 的細項
-- （例如「直立式洗衣機 3-17公斤 1800 元」），所以開 5 個 OLD-XX 收尾。
--
-- default_price 使用各類型最常見的歷史單價：
--   直立 1600（2016~2021 主力）/ 滾筒 3800 / 冷氣 2500 / 床墊 1800 / 沙發 2500
-- 老闆娘可在 /settings/services 把這 5 項標為 inactive、不出現在新訂單下拉選單，
-- 但既有舊訂單 reference 仍會保留（service_items.code unique，不會被刪）。
-- ============================================================================

insert into public.service_items (code, name, default_price, category, sort_order, active) values
  ('OLD-WASHER-VERTICAL', '舊資料-直立式洗衣機', 1600, 'washing_vertical', 9001, true),
  ('OLD-WASHER-DRUM',     '舊資料-滾筒洗衣機',   3800, 'washing_drum',     9002, true),
  ('OLD-AC',              '舊資料-冷氣',         2500, 'ac_split',         9003, true),
  ('OLD-MATTRESS',        '舊資料-床墊',         1800, 'mattress',         9004, true),
  ('OLD-SOFA',            '舊資料-沙發',         2500, 'sofa',             9005, true)
on conflict (code) do nothing;
