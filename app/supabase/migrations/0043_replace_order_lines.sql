-- ============================================================================
-- 0043 修正：updateOrderAction 的 replace-all 改成單一交易（健檢 #11）
-- ============================================================================
-- 背景：後台「編輯訂單」原本由 action 分四步執行：update orders → delete 全部
-- order_items → insert 新 items → delete/insert adjustments。中途任何一步失敗
-- （網路、validation、constraint），訂單就停在「品項已刪、新品項沒進去」的狀態，
-- orders.total 被 trigger 歸 0，且無法 rollback。
--
-- 修正：品項 + 加減項的 replace 包進一個 plpgsql function（單一交易），
-- 任一步失敗整包 rollback，訂單品項不會消失。
--
-- 權限：維持 security invoker（預設），RLS 照常生效——technician 對 order_items
-- 無 UPDATE/DELETE 權限，直接打 /rest/v1/rpc/replace_order_lines 會被 RLS 擋；
-- owner/manager 與現行 action 的 delete/insert 權限相同。
--
-- p_items 元素: {machine_id?, service_item_id, technician_id?, quantity,
--                unit_price, tag?, note?}
-- p_adjustments 元素: {adjustment_item_id?, order_item_index?, name_snapshot,
--                      type('addon'|'discount'), amount, note?}
--   order_item_index 為 p_items 的 0-based 序號（品項級加減項），null＝訂單級。
-- ============================================================================

create or replace function public.replace_order_lines(
  p_order_id uuid,
  p_items jsonb,
  p_adjustments jsonb
) returns void
language plpgsql
as $$
declare
  it jsonb;
  adj jsonb;
  new_ids uuid[] := '{}';
  nid uuid;
  idx int;
begin
  -- 先刪 adjustments 再刪 items（adjustments.order_item_id 參照 items）
  delete from public.order_adjustments where order_id = p_order_id;
  delete from public.order_items where order_id = p_order_id;

  -- 逐列 insert 保證 new_ids 與輸入順序一致（品項級加減項靠序號對應）
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.order_items
      (order_id, machine_id, service_item_id, technician_id,
       quantity, unit_price, subtotal, tag, note)
    values
      (p_order_id,
       nullif(it->>'machine_id', '')::uuid,
       (it->>'service_item_id')::uuid,
       nullif(it->>'technician_id', '')::uuid,
       coalesce((it->>'quantity')::int, 1),
       coalesce((it->>'unit_price')::numeric, 0),
       coalesce((it->>'quantity')::int, 1) * coalesce((it->>'unit_price')::numeric, 0),
       nullif(it->>'tag', ''),
       nullif(it->>'note', ''))
    returning id into nid;
    new_ids := new_ids || nid;
  end loop;

  for adj in select * from jsonb_array_elements(coalesce(p_adjustments, '[]'::jsonb))
  loop
    idx := (adj->>'order_item_index')::int;  -- null 安全：null::int 仍是 null
    insert into public.order_adjustments
      (order_id, adjustment_item_id, order_item_id, name_snapshot, type, amount, note)
    values
      (p_order_id,
       nullif(adj->>'adjustment_item_id', '')::uuid,
       case when idx is not null then new_ids[idx + 1] else null end,
       adj->>'name_snapshot',
       (adj->>'type')::public.adjustment_type,
       coalesce((adj->>'amount')::numeric, 0),
       nullif(adj->>'note', ''));
  end loop;
end $$;
