-- 0036 adjustment_items 加 category（顯示分組），type 仍管金額 +/- 數學
--   category: 'service'(服務加收) | 'parts'(零件加收) | 'discount'(優惠折扣)
--   - service/parts 一定是 addon；discount 一定是 discount（寫入時由 category 推導 type）
--   回填：現有 addon→'service'（「零件」是全新概念，舊 addon 都是服務性質）；discount→'discount'
alter table public.adjustment_items
  add column if not exists category text;

update public.adjustment_items
set category = case when type = 'discount' then 'discount' else 'service' end
where category is null;

alter table public.adjustment_items
  alter column category set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'adjustment_items_category_chk'
  ) then
    alter table public.adjustment_items
      add constraint adjustment_items_category_chk
      check (category in ('service', 'parts', 'discount'));
  end if;
end $$;

-- 零件逃生口：清單沒有的臨時零件，師傅選這項、金額自填、品名寫備註（避免自由打字造成用詞髒）
insert into public.adjustment_items (name, type, category, default_amount, affects_commission, active)
select '其他零件', 'addon', 'parts', 0, true, true
where not exists (
  select 1 from public.adjustment_items where name = '其他零件' and category = 'parts'
);
