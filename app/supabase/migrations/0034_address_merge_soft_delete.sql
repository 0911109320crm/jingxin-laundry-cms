-- ============================================================================
-- 0034 地址合併（軟刪除 + 可復原）
-- ============================================================================
-- 舊資料匯入常造成「同一地址多筆」(漏鄰里/錯字)。提供合併功能：把訂單/機器改指到
-- 保留的地址，重複地址「軟刪除」(標記 merged_into_id，不真刪) → 可復原。
-- 列出地址的查詢一律加 `merged_into_id is null` 過濾掉已併入的。
-- ============================================================================

alter table public.customer_addresses
  add column if not exists merged_into_id uuid references public.customer_addresses(id) on delete set null,
  add column if not exists merged_at timestamptz,
  add column if not exists merged_by uuid references public.user_profiles(id) on delete set null;

comment on column public.customer_addresses.merged_into_id is
  '非 null = 此地址已被合併到該 id(軟刪除、不顯示)；可清空以復原。';

-- 加速「過濾掉已合併地址」的查詢
create index if not exists idx_addresses_not_merged
  on public.customer_addresses (customer_id) where merged_into_id is null;
