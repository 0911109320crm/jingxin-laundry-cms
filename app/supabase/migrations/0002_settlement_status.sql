-- ============================================================================
-- 0002 Settlement (回繳) 狀態
-- ============================================================================
-- 收款 / 回繳兩個欄位:
--   payment_method     unpaid | cash | transfer | card | line_pay
--   settlement_status  pending  (待回繳)
--                      settled  (已回繳)
--                      not_required (免回繳)
--
-- 自動規則 (via trigger):
--   payment_method in ('transfer','card','line_pay') -> settlement = not_required
--   payment_method in ('unpaid','cash')              -> settlement = pending
--                                                       (但若已 settled 則保留)
-- 手動規則:
--   老闆娘在「師傅待回繳」頁按「已回繳」 -> settlement = settled
-- ============================================================================

create type public.settlement_status as enum ('pending', 'settled', 'not_required');

alter table public.orders
  add column settlement_status public.settlement_status not null default 'pending';

-- 既有資料初始化
update public.orders
   set settlement_status = case
     when payment_method in ('transfer', 'card', 'line_pay') then 'not_required'::public.settlement_status
     else 'pending'::public.settlement_status
   end;

-- INSERT: 依 payment_method 決定 settlement_status
create or replace function public.init_settlement_status()
returns trigger language plpgsql as $$
begin
  if NEW.settlement_status is null or NEW.settlement_status = 'pending'::public.settlement_status then
    if NEW.payment_method in ('transfer', 'card', 'line_pay') then
      NEW.settlement_status = 'not_required';
    else
      NEW.settlement_status = 'pending';
    end if;
  end if;
  return NEW;
end $$;

create trigger trg_init_settlement
  before insert on public.orders
  for each row execute function public.init_settlement_status();

-- UPDATE payment_method: 同步 settlement_status (但已 settled 不覆蓋)
create or replace function public.sync_settlement_status()
returns trigger language plpgsql as $$
begin
  if NEW.settlement_status = 'settled'::public.settlement_status
     and OLD.settlement_status = 'settled'::public.settlement_status then
    return NEW;  -- 已回繳的訂單不自動回退
  end if;
  if NEW.payment_method in ('transfer', 'card', 'line_pay') then
    NEW.settlement_status = 'not_required';
  elsif NEW.payment_method in ('unpaid', 'cash') or NEW.payment_method is null then
    if NEW.settlement_status != 'settled'::public.settlement_status then
      NEW.settlement_status = 'pending';
    end if;
  end if;
  return NEW;
end $$;

create trigger trg_sync_settlement
  before update of payment_method on public.orders
  for each row
  when (OLD.payment_method is distinct from NEW.payment_method)
  execute function public.sync_settlement_status();

create index idx_orders_settlement on public.orders (settlement_status);
create index idx_orders_settlement_method on public.orders (payment_method, settlement_status);
