-- 0044_rls_perf_wrap_session_functions.sql
-- 效能優化：把 RLS 規則中的 session 函式(auth.uid/current_role/is_readonly)包成 (select ...)，
-- 讓 Postgres 每次查詢只算一次而非逐列呼叫。純效能、行為不變(已驗證三角色可見筆數一致)。
-- 由 scripts 依當時 pg_policies 產生後套用。
--
-- ⚠ 注意：本檔「非冪等」。已於 2026-07-02 直接套用到正式資料庫並驗證通過。
--    請勿對「已套用」的資料庫重跑，否則會把 (select f()) 再包一層成 (select (select f()))
--    (功能無誤但多餘)。僅在「從 0001 重建的全新資料庫」情境下依序執行到本檔。

ALTER POLICY "read all auth" ON public.adjustment_items
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "write manager+" ON public.adjustment_items
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "audit insert any auth" ON public.audit_logs
  WITH CHECK (((select auth.uid()) IS NOT NULL));

ALTER POLICY "audit owner read" ON public.audit_logs
  USING (((select "current_role"()) = 'owner'::user_role));

ALTER POLICY "calendar_notes_self" ON public.calendar_notes
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY "read all auth" ON public.customer_addresses
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "ro_deny_del" ON public.customer_addresses
  USING ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_ins" ON public.customer_addresses
  WITH CHECK ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_upd" ON public.customer_addresses
  USING ((NOT (select is_readonly())));

ALTER POLICY "write manager+" ON public.customer_addresses
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "phones read all auth" ON public.customer_phones
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "phones write manager+" ON public.customer_phones
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "ro_deny_del" ON public.customer_phones
  USING ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_ins" ON public.customer_phones
  WITH CHECK ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_upd" ON public.customer_phones
  USING ((NOT (select is_readonly())));

ALTER POLICY "read all auth" ON public.customer_sources
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "write manager+" ON public.customer_sources
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "read all auth" ON public.customers
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "ro_deny_del" ON public.customers
  USING ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_ins" ON public.customers
  WITH CHECK ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_upd" ON public.customers
  USING ((NOT (select is_readonly())));

ALTER POLICY "write manager+" ON public.customers
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "imports manager+" ON public.import_logs
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "brands read all" ON public.machine_brands
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "brands write manager+" ON public.machine_brands
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "machines insert technician own customer" ON public.machines
  WITH CHECK ((((select "current_role"()) = 'technician'::user_role) AND (EXISTS ( SELECT 1
   FROM (order_items oi
     JOIN orders o ON ((o.id = oi.order_id)))
  WHERE ((oi.technician_id = (select auth.uid())) AND (o.customer_id = machines.customer_id))))));

ALTER POLICY "machines update technician own customer" ON public.machines
  USING ((((select "current_role"()) = 'technician'::user_role) AND (EXISTS ( SELECT 1
   FROM (order_items oi
     JOIN orders o ON ((o.id = oi.order_id)))
  WHERE ((oi.technician_id = (select auth.uid())) AND (o.customer_id = machines.customer_id))))))
  WITH CHECK ((((select "current_role"()) = 'technician'::user_role) AND (EXISTS ( SELECT 1
   FROM (order_items oi
     JOIN orders o ON ((o.id = oi.order_id)))
  WHERE ((oi.technician_id = (select auth.uid())) AND (o.customer_id = machines.customer_id))))));

ALTER POLICY "read all auth" ON public.machines
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "ro_deny_del" ON public.machines
  USING ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_ins" ON public.machines
  WITH CHECK ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_upd" ON public.machines
  USING ((NOT (select is_readonly())));

ALTER POLICY "write manager+" ON public.machines
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "adj read" ON public.order_adjustments
  USING ((((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])) OR (EXISTS ( SELECT 1
   FROM order_items oi
  WHERE ((oi.order_id = order_adjustments.order_id) AND (oi.technician_id = (select auth.uid())))))));

ALTER POLICY "adj write manager+" ON public.order_adjustments
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "ro_deny_del" ON public.order_adjustments
  USING ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_ins" ON public.order_adjustments
  WITH CHECK ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_upd" ON public.order_adjustments
  USING ((NOT (select is_readonly())));

ALTER POLICY "items read" ON public.order_items
  USING ((((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])) OR (technician_id = (select auth.uid()))));

ALTER POLICY "items update own" ON public.order_items
  USING ((technician_id = (select auth.uid())))
  WITH CHECK ((technician_id = (select auth.uid())));

ALTER POLICY "items write manager+" ON public.order_items
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "ro_deny_del" ON public.order_items
  USING ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_ins" ON public.order_items
  WITH CHECK ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_upd" ON public.order_items
  USING ((NOT (select is_readonly())));

ALTER POLICY "order promo delete technician self" ON public.order_promotions
  USING (((credited_to = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM order_items oi
  WHERE ((oi.order_id = order_promotions.order_id) AND (oi.technician_id = (select auth.uid())))))));

ALTER POLICY "order promo insert technician self" ON public.order_promotions
  WITH CHECK (((credited_to = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM order_items oi
  WHERE ((oi.order_id = order_promotions.order_id) AND (oi.technician_id = (select auth.uid())))))));

ALTER POLICY "order promo read" ON public.order_promotions
  USING ((((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])) OR (credited_to = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM order_items oi
  WHERE ((oi.order_id = order_promotions.order_id) AND (oi.technician_id = (select auth.uid())))))));

ALTER POLICY "order promo write manager+" ON public.order_promotions
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "ro_deny_del" ON public.order_promotions
  USING ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_ins" ON public.order_promotions
  WITH CHECK ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_upd" ON public.order_promotions
  USING ((NOT (select is_readonly())));

ALTER POLICY "orders read" ON public.orders
  USING ((((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])) OR (EXISTS ( SELECT 1
   FROM order_items oi
  WHERE ((oi.order_id = orders.id) AND (oi.technician_id = (select auth.uid())))))));

ALTER POLICY "orders write manager+" ON public.orders
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "ro_deny_del" ON public.orders
  USING ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_ins" ON public.orders
  WITH CHECK ((NOT (select is_readonly())));

ALTER POLICY "ro_deny_upd" ON public.orders
  USING ((NOT (select is_readonly())));

ALTER POLICY "payroll_adj read auth" ON public.payroll_adjustments
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "payroll_adj write manager+" ON public.payroll_adjustments
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "payroll_snap read auth" ON public.payroll_snapshots
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "payroll_snap write owner" ON public.payroll_snapshots
  USING (((select "current_role"()) = 'owner'::user_role))
  WITH CHECK (((select "current_role"()) = 'owner'::user_role));

ALTER POLICY "promo types read all" ON public.promotion_types
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "promo types write manager+" ON public.promotion_types
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "reminders manager+" ON public.reminders
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "read all auth" ON public.service_items
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "write manager+" ON public.service_items
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "tag presets read all" ON public.service_tag_presets
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "tag presets write manager+" ON public.service_tag_presets
  USING (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))
  WITH CHECK (((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role])));

ALTER POLICY "settings read all auth" ON public.system_settings
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "settings write owner" ON public.system_settings
  USING (((select "current_role"()) = 'owner'::user_role))
  WITH CHECK (((select "current_role"()) = 'owner'::user_role));

ALTER POLICY "tech_expenses_admin_all" ON public.technician_expenses
  USING ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = (select auth.uid())) AND (up.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = (select auth.uid())) AND (up.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))));

ALTER POLICY "tech_expenses_self_read" ON public.technician_expenses
  USING ((technician_id = (select auth.uid())));

ALTER POLICY "tech_leave_admin_all" ON public.technician_leave
  USING ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = (select auth.uid())) AND (up.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = (select auth.uid())) AND (up.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))));

ALTER POLICY "tech_leave_self_read" ON public.technician_leave
  USING ((technician_id = (select auth.uid())));

ALTER POLICY "profile owner all" ON public.user_profiles
  USING (((select "current_role"()) = 'owner'::user_role))
  WITH CHECK (((select "current_role"()) = 'owner'::user_role));

ALTER POLICY "profile self read" ON public.user_profiles
  USING (((id = (select auth.uid())) OR ((select "current_role"()) = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))));
