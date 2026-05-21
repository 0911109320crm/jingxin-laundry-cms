-- ============================================================================
-- 0012 Allow technicians to write order_adjustments on their own orders
-- ============================================================================
-- Technicians can insert/delete adjustments for orders they are assigned to.
-- The ownership check (order_items.technician_id = auth.uid()) mirrors
-- the code-level check in actions.ts.
-- ============================================================================

create policy "adj write technician own" on public.order_adjustments
  for all
  using (
    exists (
      select 1 from public.order_items oi
      where oi.order_id = order_adjustments.order_id
        and oi.technician_id = auth.uid()
    )
    and public.current_role() = 'technician'
  )
  with check (
    exists (
      select 1 from public.order_items oi
      where oi.order_id = order_adjustments.order_id
        and oi.technician_id = auth.uid()
    )
    and public.current_role() = 'technician'
  );
