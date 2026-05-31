-- ============================================================================
-- 0023 老闆娘建單下拉：精簡為純中文品名 + 調整 basic_choice 清單
-- ============================================================================
-- 老闆娘 2026-05-31 需求：
--   1. 建單「類型」下拉只要 7 個純中文選項，不要英文代號(WV-S/WTUB…)與尺寸後綴：
--        直立式洗衣機 / 滾筒式洗衣機 / 分離式冷氣 / 吊隱式冷氣 /
--        床墊除蟎 / 床墊清洗 / 沙發
--      （床墊兩項都留，老闆娘 2026-05-31 確認；英文代號隱藏由前端處理）
--   2. 移除「雙槽式洗衣機」(WTUB) 的 basic_choice — 不再出現在建單下拉。
--
-- 設計原則：
--   - 只改 basic_choice 代表項的 name（給老闆娘看的精簡品名）與 is_basic_choice 旗標。
--   - 不動 category、不動 code、不刪任何 service_item → 歷史訂單(以 service_item_id 參照)
--     完全不受影響；師傅 PWA 仍看完整尺寸表(非 basic_choice 項仍保留原尺寸品名)。
--   - WTUB 只是取消 basic_choice，category/資料保留，雙槽式老客戶歷史單不壞。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) basic_choice 代表項改成純中文精簡品名（去掉尺寸後綴）
-- ---------------------------------------------------------------------------
update public.service_items set name = '直立式洗衣機' where code = 'WV-S';
update public.service_items set name = '滾筒式洗衣機' where code = 'WD-L1';
update public.service_items set name = '分離式冷氣'   where code = 'AC-S';
update public.service_items set name = '吊隱式冷氣'   where code = 'AH-S';  -- 0022 已改，這裡 safety 再補
update public.service_items set name = '沙發'         where code = 'SF-100';
update public.service_items set name = '床墊除蟎'     where code = 'BD-S';
update public.service_items set name = '床墊清洗'     where code = 'BW-S';

-- ---------------------------------------------------------------------------
-- 2) 雙槽式不再是建單基本選項（資料保留，只關旗標）
-- ---------------------------------------------------------------------------
update public.service_items set is_basic_choice = false where code = 'WTUB';

-- ---------------------------------------------------------------------------
-- 3) 確保 7 個代表項都是 basic_choice（safety）
-- ---------------------------------------------------------------------------
update public.service_items
   set is_basic_choice = true
 where code in ('WV-S', 'WD-L1', 'AC-S', 'AH-S', 'SF-100', 'BD-S', 'BW-S');
