-- ============================================================================
-- 0015 Allow technicians to insert / update machines on their own orders
-- ============================================================================
-- 老闆娘在建立訂單時不知道機器品牌 / 機型，這部分改由師傅到現場時在 PWA 補。
-- 既有 RLS：machines 表只有 manager+ 可寫。本 migration 新增 technician 寫權限：
--   - INSERT：tech 可建立新機器，但 customer_id 必須對應某張他被指派的 order
--   - UPDATE：tech 可更新該客戶旗下的機器（限他經手的 order 客戶）
-- ============================================================================

create policy "machines insert technician own customer"
  on public.machines
  for insert
  with check (
    public.current_role() = 'technician'
    and exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.technician_id = auth.uid()
        and o.customer_id = machines.customer_id
    )
  );

create policy "machines update technician own customer"
  on public.machines
  for update
  using (
    public.current_role() = 'technician'
    and exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.technician_id = auth.uid()
        and o.customer_id = machines.customer_id
    )
  )
  with check (
    public.current_role() = 'technician'
    and exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.technician_id = auth.uid()
        and o.customer_id = machines.customer_id
    )
  );
