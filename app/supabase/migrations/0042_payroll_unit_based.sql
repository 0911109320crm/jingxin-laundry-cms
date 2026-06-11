-- ============================================================================
-- 0042 算台數薪資模型（取代百分比抽成）
-- ============================================================================
-- 老闆娘 2026-06-10 版薪資規則：不論洗什麼都「算台數」。
--   本薪      = 固定 29900（= 65 台 × 460），未達 65 台仍領滿
--   台數獎金  = 第 66 台起，每台 +520
--   技術獎金  = 每台機型加給（滾筒+760、吊隱+340、加大冷氣+100、躍動式+140…）
--             改放在「品項主檔 service_items.unit_bonus」，老闆娘可自行維護金額；
--             一台機器 = 一筆 order_item，建單選哪個品項就吃那個品項的 unit_bonus。
--   未拆解    = 跨品項的現場狀態，用 order_items.undismantled 旗標（師傅施工時勾）。
--   全勤      = +2000（當月無休假登記）
--   伙食津貼  = 1200 + 出勤日 × 50（出勤日 = 當月有派案的不重複台北日期）
--   行銷獎金  = 客戶打卡積分超過門檻(30)後，每多 1 分 +10
--   維修/執行/浮動 = 走既有 payroll_adjustments（bonus/deduction + reason）手動加減
-- 所有費率常數放 system_settings.key='payroll_v2'，老闆娘後台可調、不寫死。
-- ============================================================================

-- 1) 每台機型技術獎金，掛在品項主檔（老闆娘可在品項設定維護）
alter table public.service_items
  add column if not exists unit_bonus numeric(10, 2) not null default 0;

comment on column public.service_items.unit_bonus is
  '每台機型技術獎金（算台數薪資用）。建單選此品項時，師傅每洗一台就加此金額。';

-- 預填：滾筒洗衣機系列 +760、吊隱式冷氣系列 +340（可對應到 category 的部分）
update public.service_items set unit_bonus = 760 where category = 'washing_drum';
update public.service_items set unit_bonus = 340 where category = 'ac_hidden';
-- 加大冷氣 +100 / 躍動式 +140 等無法用 category 一刀切，留給老闆娘在品項主檔逐項設定。

-- 2) 未拆解旗標（師傅現場勾，薪資每台 +undismantled_bonus）
alter table public.order_items
  add column if not exists undismantled boolean not null default false;

comment on column public.order_items.undismantled is
  '未拆解（機器拆不起/拆後不洗，現場直接洗）。算台數薪資的「未拆解技術獎金」依據。';

-- 3) 薪資常數
insert into public.system_settings (key, value)
values (
  'payroll_v2',
  jsonb_build_object(
    'base_salary', 29900,        -- 本薪（保底）
    'base_units', 65,            -- 本薪內含台數
    'overage_unit_rate', 520,    -- 第 66 台起每台
    'undismantled_bonus', 100,   -- 未拆解每台加給
    'full_attendance_bonus', 2000,
    'meal_base', 1200,
    'meal_per_day', 50,
    'marketing_threshold', 30,   -- 積分門檻（與 monthly_promotion_kpi 對齊）
    'marketing_per_point', 10
  )
)
on conflict (key) do nothing;
