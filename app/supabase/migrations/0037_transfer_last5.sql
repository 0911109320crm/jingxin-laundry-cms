-- 0037 轉帳收款：記錄轉帳帳號後五碼，供老闆娘比對銀行入帳明細
--   payment_method='transfer' 時，師傅填客戶轉出帳號後五碼（或留空＝客戶稍後才轉）
--   結算流程沿用 settlement_status：transfer 設 pending（待老闆娘確認入帳）→ settled
alter table public.orders
  add column if not exists transfer_last5 text;

comment on column public.orders.transfer_last5 is
  '轉帳帳號後五碼（payment_method=transfer 時）；null 代表客戶稍後才轉、尚未提供';
