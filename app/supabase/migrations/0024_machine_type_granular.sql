-- ============================================================================
-- 0024 machines.type enum 細分（與建單分類 / machine_brands.category 統一）
-- ============================================================================
-- 老闆娘 2026-05-31 需求：新增顧客→機器類型下拉，要和建單分類一致，改成
--   直立式洗衣機 / 雙槽式洗衣機 / 滾筒式洗衣機 / 分離式冷氣 / 吊隱式冷氣 / 床墊 / 沙發
--
-- 做法（採 Gemini 建議的低風險方案）：
--   - 只「新增」enum 值，不動舊值 → 既有上萬筆機器資料(washing_machine /
--     air_conditioner 等)完全不受影響，仍可正常顯示與編輯。
--   - 舊的 washing_machine / air_conditioner 不強制轉換(無法判斷直立/滾筒、分離/吊隱)，
--     UI label 顯示為「洗衣機(待分類)」「冷氣(待分類)」，老闆娘日後編輯時自然改細。
--   - 新增機器才會用到新的細分值。
--
-- ⚠️ 注意：ALTER TYPE ... ADD VALUE 為 DDL，需在 Supabase SQL Editor 或
--    supabase CLI 執行（PostgREST / service role 的 supabase-js 無法跑 DDL）。
--    本檔為純新增、可重複執行(IF NOT EXISTS)，安全。
-- ============================================================================

alter type public.machine_type add value if not exists 'washing_vertical';
alter type public.machine_type add value if not exists 'washing_twin_tub';
alter type public.machine_type add value if not exists 'washing_drum';
alter type public.machine_type add value if not exists 'ac_split';
alter type public.machine_type add value if not exists 'ac_hidden';

comment on type public.machine_type is
  '機器類型。新值(2026-05-31)：washing_vertical/washing_twin_tub/washing_drum/'
  'ac_split/ac_hidden + mattress/sofa/other。舊值 washing_machine/air_conditioner '
  '保留供既有資料，新增機器一律用細分值。';
