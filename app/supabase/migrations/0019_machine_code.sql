-- ============================================================================
-- 0019 機器自訂編碼
-- ============================================================================
-- 老闆娘希望師傅到現場時可以給機器設一組自訂編碼（例如 A-01、客戶自編號），
-- 未來客戶報號就能直接查到機器 → 帶出該機器歷史 → 加快建單。
--
-- - machines.code：text，nullable（不強制每台都要編）
-- - 全域搜尋（Ctrl+K）會把 code 加入命中條件
-- - 用 trigram 索引支援 fuzzy 模糊搜尋
-- ============================================================================

alter table public.machines
  add column if not exists code text;

create index if not exists idx_machines_code_trgm
  on public.machines using gin (code gin_trgm_ops)
  where code is not null;

comment on column public.machines.code is
  '自訂機器編碼（如 A-01、AC-1F），nullable。可用於全域搜尋。';
