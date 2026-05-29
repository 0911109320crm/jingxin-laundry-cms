-- ============================================================================
-- 0024 訂單現金收款人（collected_by）
-- ============================================================================
-- 老闆娘 2026-05-29 反映：一張單多服務時會同時派多位師傅，先做完的師傅趕下一個
-- 行程先走，最後離開的那位幫忙收了整張單的全部現金。
--
-- 原本「待回繳」是用「最早建立 item 的師傅」推測收款人 → 多師傅情境會把整單現金
-- 錯歸給先做的人，而非實際收錢的人。
--
-- 設計：
--   - orders 新增 collected_by_technician_id，記錄「實際收這筆現金的人」
--   - 師傅在 PWA 按「收到現金」時，由後端蓋章為當下登入的師傅
--   - 待回繳對帳一律以此欄位歸屬；舊資料（null）回退用最早 item 師傅推測
--   - 計件薪資不受影響（仍按 order_items.technician_id 各算各的）
-- ============================================================================

alter table public.orders
  add column if not exists collected_by_technician_id uuid
    references public.user_profiles(id) on delete set null;

comment on column public.orders.collected_by_technician_id is
  '實際收取本訂單現金的師傅；待回繳對帳依此歸屬。null = 尚未收現金或舊資料（回退用最早 item 師傅）。';

create index if not exists idx_orders_collected_by
  on public.orders (collected_by_technician_id);
