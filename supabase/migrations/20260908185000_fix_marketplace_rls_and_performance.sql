-- Fix supplier/public RLS predicates that accidentally compared a column to itself.
DROP POLICY IF EXISTS food_orders_supplier_read ON public.food_orders;
CREATE POLICY food_orders_supplier_read ON public.food_orders FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.supplier_accounts sa WHERE sa.user_id = (select auth.uid()) AND sa.business_id = food_orders.business_id)
);
DROP POLICY IF EXISTS food_orders_supplier_update ON public.food_orders;
CREATE POLICY food_orders_supplier_update ON public.food_orders FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.supplier_accounts sa WHERE sa.user_id = (select auth.uid()) AND sa.business_id = food_orders.business_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.supplier_accounts sa WHERE sa.user_id = (select auth.uid()) AND sa.business_id = food_orders.business_id)
);

DROP POLICY IF EXISTS restaurant_categories_public_read ON public.restaurant_menu_categories;
CREATE POLICY restaurant_categories_public_read ON public.restaurant_menu_categories FOR SELECT TO anon, authenticated USING (
  active AND EXISTS (SELECT 1 FROM public.restaurant_settings s WHERE s.business_id = restaurant_menu_categories.business_id AND s.ordering_enabled)
);
DROP POLICY IF EXISTS restaurant_categories_supplier_manage ON public.restaurant_menu_categories;
CREATE POLICY restaurant_categories_supplier_manage ON public.restaurant_menu_categories FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.supplier_accounts sa WHERE sa.user_id = (select auth.uid()) AND sa.business_id = restaurant_menu_categories.business_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.supplier_accounts sa WHERE sa.user_id = (select auth.uid()) AND sa.business_id = restaurant_menu_categories.business_id)
);

DROP POLICY IF EXISTS restaurant_items_public_read ON public.restaurant_menu_items;
CREATE POLICY restaurant_items_public_read ON public.restaurant_menu_items FOR SELECT TO anon, authenticated USING (
  active AND available AND EXISTS (SELECT 1 FROM public.restaurant_settings s WHERE s.business_id = restaurant_menu_items.business_id AND s.ordering_enabled)
);
DROP POLICY IF EXISTS restaurant_items_supplier_manage ON public.restaurant_menu_items;
CREATE POLICY restaurant_items_supplier_manage ON public.restaurant_menu_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.supplier_accounts sa WHERE sa.user_id = (select auth.uid()) AND sa.business_id = restaurant_menu_items.business_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.supplier_accounts sa WHERE sa.user_id = (select auth.uid()) AND sa.business_id = restaurant_menu_items.business_id)
);

DROP POLICY IF EXISTS restaurant_settings_supplier_manage ON public.restaurant_settings;
CREATE POLICY restaurant_settings_supplier_manage ON public.restaurant_settings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.supplier_accounts sa WHERE sa.user_id = (select auth.uid()) AND sa.business_id = restaurant_settings.business_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.supplier_accounts sa WHERE sa.user_id = (select auth.uid()) AND sa.business_id = restaurant_settings.business_id)
);

DROP POLICY IF EXISTS restaurant_options_supplier_manage ON public.restaurant_menu_item_options;
CREATE POLICY restaurant_options_supplier_manage ON public.restaurant_menu_item_options FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.restaurant_menu_items i JOIN public.supplier_accounts sa ON sa.business_id = i.business_id WHERE i.id = restaurant_menu_item_options.menu_item_id AND sa.user_id = (select auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurant_menu_items i JOIN public.supplier_accounts sa ON sa.business_id = i.business_id WHERE i.id = restaurant_menu_item_options.menu_item_id AND sa.user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS restaurant_options_public_read ON public.restaurant_menu_item_options;
CREATE POLICY restaurant_options_public_read ON public.restaurant_menu_item_options FOR SELECT TO anon, authenticated USING (
  active AND EXISTS (
    SELECT 1 FROM public.restaurant_menu_items i JOIN public.restaurant_settings s ON s.business_id = i.business_id
    WHERE i.id = restaurant_menu_item_options.menu_item_id AND i.active AND i.available AND s.ordering_enabled
  )
);

DROP POLICY IF EXISTS restaurant_option_values_supplier_manage ON public.restaurant_menu_item_option_values;
CREATE POLICY restaurant_option_values_supplier_manage ON public.restaurant_menu_item_option_values FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_menu_item_options o
    JOIN public.restaurant_menu_items i ON i.id = o.menu_item_id
    JOIN public.supplier_accounts sa ON sa.business_id = i.business_id
    WHERE o.id = restaurant_menu_item_option_values.option_id AND sa.user_id = (select auth.uid())
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_menu_item_options o
    JOIN public.restaurant_menu_items i ON i.id = o.menu_item_id
    JOIN public.supplier_accounts sa ON sa.business_id = i.business_id
    WHERE o.id = restaurant_menu_item_option_values.option_id AND sa.user_id = (select auth.uid())
  )
);
DROP POLICY IF EXISTS restaurant_option_values_public_read ON public.restaurant_menu_item_option_values;
CREATE POLICY restaurant_option_values_public_read ON public.restaurant_menu_item_option_values FOR SELECT TO anon, authenticated USING (
  active AND EXISTS (
    SELECT 1 FROM public.restaurant_menu_item_options o
    JOIN public.restaurant_menu_items i ON i.id = o.menu_item_id
    JOIN public.restaurant_settings s ON s.business_id = i.business_id
    WHERE o.id = restaurant_menu_item_option_values.option_id AND o.active AND i.active AND i.available AND s.ordering_enabled
  )
);

DROP POLICY IF EXISTS food_orders_customer_read ON public.food_orders;
CREATE POLICY food_orders_customer_read ON public.food_orders FOR SELECT TO authenticated USING (customer_user_id = (select auth.uid()));
DROP POLICY IF EXISTS food_order_items_customer_read ON public.food_order_items;
CREATE POLICY food_order_items_customer_read ON public.food_order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.food_orders o WHERE o.id = food_order_items.order_id AND o.customer_user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS food_order_items_supplier_read ON public.food_order_items;
CREATE POLICY food_order_items_supplier_read ON public.food_order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.food_orders o JOIN public.supplier_accounts sa ON sa.business_id = o.business_id WHERE o.id = food_order_items.order_id AND sa.user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS food_order_item_options_customer_read ON public.food_order_item_options;
CREATE POLICY food_order_item_options_customer_read ON public.food_order_item_options FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.food_order_items oi JOIN public.food_orders o ON o.id = oi.order_id WHERE oi.id = food_order_item_options.order_item_id AND o.customer_user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS food_order_item_options_supplier_read ON public.food_order_item_options;
CREATE POLICY food_order_item_options_supplier_read ON public.food_order_item_options FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.food_order_items oi JOIN public.food_orders o ON o.id = oi.order_id JOIN public.supplier_accounts sa ON sa.business_id = o.business_id WHERE oi.id = food_order_item_options.order_item_id AND sa.user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS food_delivery_customer_read ON public.food_delivery_assignments;
CREATE POLICY food_delivery_customer_read ON public.food_delivery_assignments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.food_orders o WHERE o.id = food_delivery_assignments.order_id AND o.customer_user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS food_delivery_driver_read ON public.food_delivery_assignments;
CREATE POLICY food_delivery_driver_read ON public.food_delivery_assignments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.driver_profiles d WHERE d.id = food_delivery_assignments.driver_id AND d.user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS food_delivery_driver_update ON public.food_delivery_assignments;
CREATE POLICY food_delivery_driver_update ON public.food_delivery_assignments FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.driver_profiles d WHERE d.id = food_delivery_assignments.driver_id AND d.user_id = (select auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.driver_profiles d WHERE d.id = food_delivery_assignments.driver_id AND d.user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS food_delivery_supplier_manage ON public.food_delivery_assignments;
CREATE POLICY food_delivery_supplier_manage ON public.food_delivery_assignments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.food_orders o JOIN public.supplier_accounts sa ON sa.business_id = o.business_id WHERE o.id = food_delivery_assignments.order_id AND sa.user_id = (select auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.food_orders o JOIN public.supplier_accounts sa ON sa.business_id = o.business_id WHERE o.id = food_delivery_assignments.order_id AND sa.user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS hotel_booking_pricing_ledger_customer_select ON public.hotel_booking_pricing_ledger;
CREATE POLICY hotel_booking_pricing_ledger_customer_select ON public.hotel_booking_pricing_ledger FOR SELECT TO authenticated USING (customer_user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users manage their own push tokens" ON public.push_notification_tokens;
CREATE POLICY "Users manage their own push tokens" ON public.push_notification_tokens FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

REVOKE EXECUTE ON FUNCTION public.get_admin_role() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.get_admin_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

ALTER FUNCTION public.sync_hotel_trip_item_ledger_reference() SET search_path = public, pg_catalog;
DROP INDEX IF EXISTS public.idx_food_orders_business;

CREATE INDEX IF NOT EXISTS ai_sales_outreach_prospect_id_idx ON public.ai_sales_outreach (prospect_id);
CREATE INDEX IF NOT EXISTS driver_compliance_alerts_vehicle_id_idx ON public.driver_compliance_alerts (vehicle_id);
CREATE INDEX IF NOT EXISTS food_delivery_assignments_assigned_by_idx ON public.food_delivery_assignments (assigned_by);
CREATE INDEX IF NOT EXISTS food_delivery_assignments_vehicle_id_idx ON public.food_delivery_assignments (vehicle_id);
CREATE INDEX IF NOT EXISTS food_order_item_options_order_item_id_idx ON public.food_order_item_options (order_item_id);
CREATE INDEX IF NOT EXISTS food_order_items_menu_item_id_idx ON public.food_order_items (menu_item_id);
CREATE INDEX IF NOT EXISTS food_order_payment_idempotency_order_id_idx ON public.food_order_payment_idempotency (order_id);
CREATE INDEX IF NOT EXISTS food_orders_accepted_by_idx ON public.food_orders (accepted_by);
CREATE INDEX IF NOT EXISTS restaurant_menu_items_category_id_idx ON public.restaurant_menu_items (category_id);
CREATE INDEX IF NOT EXISTS service_appointment_status_events_actor_user_id_idx ON public.service_appointment_status_events (actor_user_id);
CREATE INDEX IF NOT EXISTS service_appointments_offering_id_idx ON public.service_appointments (offering_id);
CREATE INDEX IF NOT EXISTS service_offerings_category_id_idx ON public.service_offerings (category_id);
CREATE INDEX IF NOT EXISTS service_profiles_category_id_idx ON public.service_profiles (category_id);
CREATE INDEX IF NOT EXISTS service_profiles_provider_terms_accepted_by_idx ON public.service_profiles (provider_terms_accepted_by);
CREATE INDEX IF NOT EXISTS service_provider_payout_accounts_verified_by_idx ON public.service_provider_payout_accounts (verified_by);
CREATE INDEX IF NOT EXISTS service_provider_payouts_approval_user_id_idx ON public.service_provider_payouts (approval_user_id);
CREATE INDEX IF NOT EXISTS service_provider_payouts_approved_by_idx ON public.service_provider_payouts (approved_by);
CREATE INDEX IF NOT EXISTS service_provider_payouts_payout_phone_verified_by_idx ON public.service_provider_payouts (payout_phone_verified_by);
CREATE INDEX IF NOT EXISTS service_provider_payouts_service_profile_id_idx ON public.service_provider_payouts (service_profile_id);
CREATE INDEX IF NOT EXISTS service_staff_user_id_idx ON public.service_staff (user_id);
CREATE INDEX IF NOT EXISTS service_staff_offerings_offering_id_idx ON public.service_staff_offerings (offering_id);
CREATE INDEX IF NOT EXISTS trip_items_city_id_idx ON public.trip_items (city_id);
CREATE INDEX IF NOT EXISTS vehicles_provider_id_idx ON public.vehicles (provider_id);
