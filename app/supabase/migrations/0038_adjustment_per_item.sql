-- 0038: 加減項可綁定特定服務品項（品項級加減項）
--
-- 情境：一筆訂單多項服務(例 洗衣機A/洗衣機B/分離式冷氣)，定期客戶每台洗衣機各折 100，
-- 但冷氣首洗不折。原本 order_adjustments 只 FK 到 order_id（訂單級），無法表達
-- 「折扣只對某些品項、且每台各折」。
--
-- 解法：加 nullable order_item_id。
--   - null  ＝ 訂單級加減項（維持現狀，整單一筆，例：車馬費、整單折讓）
--   - 有值  ＝ 品項級加減項（綁定該 order_item，例：定期優惠 -100）
--
-- 總額計算「不變」：refresh_order_totals 的 trigger 本來就把整張單所有 order_adjustments
-- 加總成 adjustments_total，含不含 order_item_id 都會被算到，所以 orders.total 自動正確。
-- 品項級只影響「顯示時把折扣歸到哪一項」與未來薪資抽成的彈性（薪資邏輯本次先不動）。
--
-- ON DELETE CASCADE：服務品項被刪除時，綁在它身上的加減項一併清除，避免孤兒資料。

alter table public.order_adjustments
  add column if not exists order_item_id uuid
    references public.order_items(id) on delete cascade;

create index if not exists idx_adjustments_item
  on public.order_adjustments (order_item_id);

comment on column public.order_adjustments.order_item_id is
  '若有值＝此加減項綁定特定 order_item（品項級）；null＝訂單級（整單）。'
  '總額計算不受影響，trigger 仍加總整張單所有 adjustment。';
