-- ============================================================================
-- 0033 師傅可檢視全部排班旗標（給「身為老闆的師傅」A-陳昶志）
-- ============================================================================
-- 需求：陳昶志實際是老闆，希望在師傅 PWA 裡能切換檢視每位師傅的排班(唯讀)。
-- 做法(Gemini+Claude 雙確認採方案B)：不動 RLS；加旗標，僅在伺服器端對「有旗標的人」
-- 用 service-role 查指定師傅排班(唯讀)。RLS 維持最嚴格、不開後門。
-- ============================================================================

alter table public.user_profiles
  add column if not exists can_view_all boolean not null default false;

comment on column public.user_profiles.can_view_all is
  '師傅可在 PWA 唯讀檢視所有師傅排班(僅伺服器端 service-role 查詢、不改 RLS)。給身為老闆的師傅。';

-- 設定陳昶志(名字含「陳昶志」，例 A-陳昶志)
update public.user_profiles
   set can_view_all = true
 where role = 'technician' and name like '%陳昶志%';
