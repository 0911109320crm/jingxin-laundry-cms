-- ============================================================================
-- 0041 修正：轉帳訂單應進「待對帳」(pending)，不是 not_required
-- ============================================================================
-- 背景：0002 的 trigger 把 transfer/card/line_pay 一律設 not_required(免回繳)。
-- 但 0037 之後新增「轉帳待對帳」流程：/payroll/transfers 與 /payroll 的待對帳卡片
-- 都查 payment_method='transfer' AND settlement_status='pending'，老闆娘核對後五碼
-- 後才按「已入帳」設 settled。trigger 從未跟著更新，導致所有轉帳訂單一進來就是
-- not_required，永遠不會出現在待對帳清單，入帳沒人確認(漏帳)。
--
-- 修正規則：
--   transfer            -> pending      (待老闆娘對帳後五碼/確認入帳)
--   card / line_pay     -> not_required (電子金流自動入帳，無需人工)
--   unpaid / cash       -> pending      (待回繳現金；維持原行為)
--   已 settled 的訂單一律不自動回退。
-- ============================================================================

-- INSERT trigger
create or replace function public.init_settlement_status()
returns trigger language plpgsql as $$
begin
  if NEW.settlement_status is null or NEW.settlement_status = 'pending'::public.settlement_status then
    if NEW.payment_method in ('card', 'line_pay') then
      NEW.settlement_status = 'not_required';
    else
      -- transfer / cash / unpaid 都待人工處理
      NEW.settlement_status = 'pending';
    end if;
  end if;
  return NEW;
end $$;

-- UPDATE payment_method trigger
create or replace function public.sync_settlement_status()
returns trigger language plpgsql as $$
begin
  if NEW.settlement_status = 'settled'::public.settlement_status
     and OLD.settlement_status = 'settled'::public.settlement_status then
    return NEW;  -- 已回繳/已入帳的訂單不自動回退
  end if;
  if NEW.payment_method in ('card', 'line_pay') then
    NEW.settlement_status = 'not_required';
  elsif NEW.payment_method in ('transfer', 'unpaid', 'cash') or NEW.payment_method is null then
    if NEW.settlement_status != 'settled'::public.settlement_status then
      NEW.settlement_status = 'pending';
    end if;
  end if;
  return NEW;
end $$;

-- 既有資料回補：把「該對帳卻被標 not_required 且尚未 settled」的轉帳單拉回 pending。
-- (歷史已 settled 的轉帳單不動，避免大量歷史訂單湧入待對帳清單。)
update public.orders
   set settlement_status = 'pending'::public.settlement_status
 where payment_method = 'transfer'
   and settlement_status = 'not_required';
