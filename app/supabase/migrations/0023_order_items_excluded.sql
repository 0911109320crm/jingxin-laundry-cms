-- ============================================================================
-- 0023 訂單品項「不服務」標記
-- ============================================================================
-- 老闆娘 2026-05-27 需求：師傅到現場發現某品項做不了（如卡軸拆不開）→
-- 需要勾選「不服務」讓該品項金額從訂單總額扣除。
--
-- 但下方 order_adjustments 的拆解費 / 車馬費仍會計入（師傅試過但機器拆不起來，
-- 仍要收車馬費 / 拆解費）。
--
-- 設計：
--   - 加 order_items.excluded boolean，預設 false
--   - 改 refresh_order_totals 排除 excluded=true 的 items
--   - subtotal 仍保留原值，方便回溯老闆娘原本估的金額
--   - UI 上師傅可隨時 toggle，老闆娘也能在後台訂單詳情看到狀態
-- ============================================================================

alter table public.order_items
  add column if not exists excluded boolean not null default false;

comment on column public.order_items.excluded is
  '師傅標記「不服務」(機器拆不開等)。subtotal 保留但不計入 orders.total。'
  'order_adjustments (拆解費/車馬費) 仍會計入。';

-- 更新 refresh_order_totals 函式：subtotal 計算時排除 excluded=true 的 items
create or replace function public.refresh_order_totals(p_order_id uuid)
returns void language plpgsql as $$
declare
  v_subtotal     numeric(10,2);
  v_addon        numeric(10,2);
  v_discount     numeric(10,2);
begin
  -- 只加總「沒被標記為不服務」的品項
  select coalesce(sum(subtotal), 0) into v_subtotal
    from public.order_items
   where order_id = p_order_id
     and excluded = false;

  select coalesce(sum(case when type = 'addon'    then amount else 0 end), 0),
         coalesce(sum(case when type = 'discount' then amount else 0 end), 0)
    into v_addon, v_discount
    from public.order_adjustments where order_id = p_order_id;

  update public.orders
     set subtotal          = v_subtotal,
         adjustments_total = v_addon - v_discount,
         total             = v_subtotal + v_addon - v_discount
   where id = p_order_id;
end $$;

-- 已存在的訂單重新跑一次 trigger，把 total 重算（理論上沒差，因為現在沒任何 excluded=true）
-- 略過，未來如果發生先手動 SQL 補。
