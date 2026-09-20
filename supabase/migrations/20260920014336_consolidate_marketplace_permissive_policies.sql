-- Driver transfer rates: preserve public eligible reads and driver-owner management
-- while avoiding overlapping SELECT policies for authenticated users.
drop policy if exists "drivers manage own transfer rates" on public.driver_transfer_rates;
drop policy if exists "public reads eligible active transfer rates" on public.driver_transfer_rates;

create policy "anon reads eligible active transfer rates"
on public.driver_transfer_rates
for select
to anon
using (
  status = 'active'
  and exists (
    select 1
    from public.driver_profiles d
    where d.id = driver_transfer_rates.driver_id
      and d.service_status = 'active'
      and d.verification_state = 'verified'
      and d.identity_liveness_verified_at is not null
      and d.personal_photo_url is not null
      and d.driving_license_compliance_status in ('valid','expiring_soon')
  )
);

create policy "authenticated reads eligible or own transfer rates"
on public.driver_transfer_rates
for select
to authenticated
using (
  (
    status = 'active'
    and exists (
      select 1
      from public.driver_profiles d
      where d.id = driver_transfer_rates.driver_id
        and d.service_status = 'active'
        and d.verification_state = 'verified'
        and d.identity_liveness_verified_at is not null
        and d.personal_photo_url is not null
        and d.driving_license_compliance_status in ('valid','expiring_soon')
    )
  )
  or exists (
    select 1
    from public.driver_profiles d
    where d.id = driver_transfer_rates.driver_id
      and d.user_id = (select auth.uid())
  )
);

create policy "drivers insert own transfer rates"
on public.driver_transfer_rates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.driver_profiles d
    where d.id = driver_transfer_rates.driver_id
      and d.user_id = (select auth.uid())
  )
);

create policy "drivers update own transfer rates"
on public.driver_transfer_rates
for update
to authenticated
using (
  exists (
    select 1
    from public.driver_profiles d
    where d.id = driver_transfer_rates.driver_id
      and d.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.driver_profiles d
    where d.id = driver_transfer_rates.driver_id
      and d.user_id = (select auth.uid())
  )
);

create policy "drivers delete own transfer rates"
on public.driver_transfer_rates
for delete
to authenticated
using (
  exists (
    select 1
    from public.driver_profiles d
    where d.id = driver_transfer_rates.driver_id
      and d.user_id = (select auth.uid())
  )
);

-- Food delivery assignments: preserve customer/driver/supplier visibility,
-- supplier management, and driver update access without overlapping policies.
drop policy if exists food_delivery_customer_read on public.food_delivery_assignments;
drop policy if exists food_delivery_driver_read on public.food_delivery_assignments;
drop policy if exists food_delivery_driver_update on public.food_delivery_assignments;
drop policy if exists food_delivery_supplier_manage on public.food_delivery_assignments;

create policy food_delivery_participant_read
on public.food_delivery_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.food_orders o
    where o.id = food_delivery_assignments.order_id
      and o.customer_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.driver_profiles d
    where d.id = food_delivery_assignments.driver_id
      and d.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.food_orders o
    join public.supplier_accounts sa on sa.business_id = o.business_id
    where o.id = food_delivery_assignments.order_id
      and sa.user_id = (select auth.uid())
  )
);

create policy food_delivery_supplier_insert
on public.food_delivery_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.food_orders o
    join public.supplier_accounts sa on sa.business_id = o.business_id
    where o.id = food_delivery_assignments.order_id
      and sa.user_id = (select auth.uid())
  )
);

create policy food_delivery_driver_or_supplier_update
on public.food_delivery_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.driver_profiles d
    where d.id = food_delivery_assignments.driver_id
      and d.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.food_orders o
    join public.supplier_accounts sa on sa.business_id = o.business_id
    where o.id = food_delivery_assignments.order_id
      and sa.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.driver_profiles d
    where d.id = food_delivery_assignments.driver_id
      and d.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.food_orders o
    join public.supplier_accounts sa on sa.business_id = o.business_id
    where o.id = food_delivery_assignments.order_id
      and sa.user_id = (select auth.uid())
  )
);

create policy food_delivery_supplier_delete
on public.food_delivery_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.food_orders o
    join public.supplier_accounts sa on sa.business_id = o.business_id
    where o.id = food_delivery_assignments.order_id
      and sa.user_id = (select auth.uid())
  )
);

-- Restaurant categories.
drop policy if exists restaurant_categories_public_read on public.restaurant_menu_categories;
drop policy if exists restaurant_categories_supplier_manage on public.restaurant_menu_categories;

create policy restaurant_categories_anon_read
on public.restaurant_menu_categories
for select
to anon
using (
  active
  and exists (
    select 1
    from public.restaurant_settings s
    where s.business_id = restaurant_menu_categories.business_id
      and s.ordering_enabled
  )
);

create policy restaurant_categories_authenticated_read
on public.restaurant_menu_categories
for select
to authenticated
using (
  (
    active
    and exists (
      select 1
      from public.restaurant_settings s
      where s.business_id = restaurant_menu_categories.business_id
        and s.ordering_enabled
    )
  )
  or exists (
    select 1
    from public.supplier_accounts sa
    where sa.user_id = (select auth.uid())
      and sa.business_id = restaurant_menu_categories.business_id
  )
);

create policy restaurant_categories_supplier_insert
on public.restaurant_menu_categories
for insert
to authenticated
with check (
  exists (
    select 1 from public.supplier_accounts sa
    where sa.user_id = (select auth.uid())
      and sa.business_id = restaurant_menu_categories.business_id
  )
);

create policy restaurant_categories_supplier_update
on public.restaurant_menu_categories
for update
to authenticated
using (
  exists (
    select 1 from public.supplier_accounts sa
    where sa.user_id = (select auth.uid())
      and sa.business_id = restaurant_menu_categories.business_id
  )
)
with check (
  exists (
    select 1 from public.supplier_accounts sa
    where sa.user_id = (select auth.uid())
      and sa.business_id = restaurant_menu_categories.business_id
  )
);

create policy restaurant_categories_supplier_delete
on public.restaurant_menu_categories
for delete
to authenticated
using (
  exists (
    select 1 from public.supplier_accounts sa
    where sa.user_id = (select auth.uid())
      and sa.business_id = restaurant_menu_categories.business_id
  )
);

-- Restaurant menu items.
drop policy if exists restaurant_items_public_read on public.restaurant_menu_items;
drop policy if exists restaurant_items_supplier_manage on public.restaurant_menu_items;

create policy restaurant_items_anon_read
on public.restaurant_menu_items
for select
to anon
using (
  active
  and available
  and exists (
    select 1 from public.restaurant_settings s
    where s.business_id = restaurant_menu_items.business_id
      and s.ordering_enabled
  )
);

create policy restaurant_items_authenticated_read
on public.restaurant_menu_items
for select
to authenticated
using (
  (
    active
    and available
    and exists (
      select 1 from public.restaurant_settings s
      where s.business_id = restaurant_menu_items.business_id
        and s.ordering_enabled
    )
  )
  or exists (
    select 1 from public.supplier_accounts sa
    where sa.user_id = (select auth.uid())
      and sa.business_id = restaurant_menu_items.business_id
  )
);

create policy restaurant_items_supplier_insert
on public.restaurant_menu_items
for insert
to authenticated
with check (
  exists (
    select 1 from public.supplier_accounts sa
    where sa.user_id = (select auth.uid())
      and sa.business_id = restaurant_menu_items.business_id
  )
);

create policy restaurant_items_supplier_update
on public.restaurant_menu_items
for update
to authenticated
using (
  exists (
    select 1 from public.supplier_accounts sa
    where sa.user_id = (select auth.uid())
      and sa.business_id = restaurant_menu_items.business_id
  )
)
with check (
  exists (
    select 1 from public.supplier_accounts sa
    where sa.user_id = (select auth.uid())
      and sa.business_id = restaurant_menu_items.business_id
  )
);

create policy restaurant_items_supplier_delete
on public.restaurant_menu_items
for delete
to authenticated
using (
  exists (
    select 1 from public.supplier_accounts sa
    where sa.user_id = (select auth.uid())
      and sa.business_id = restaurant_menu_items.business_id
  )
);

-- Restaurant item options.
drop policy if exists restaurant_options_public_read on public.restaurant_menu_item_options;
drop policy if exists restaurant_options_supplier_manage on public.restaurant_menu_item_options;

create policy restaurant_options_anon_read
on public.restaurant_menu_item_options
for select
to anon
using (
  active
  and exists (
    select 1
    from public.restaurant_menu_items i
    join public.restaurant_settings s on s.business_id = i.business_id
    where i.id = restaurant_menu_item_options.menu_item_id
      and i.active
      and i.available
      and s.ordering_enabled
  )
);

create policy restaurant_options_authenticated_read
on public.restaurant_menu_item_options
for select
to authenticated
using (
  (
    active
    and exists (
      select 1
      from public.restaurant_menu_items i
      join public.restaurant_settings s on s.business_id = i.business_id
      where i.id = restaurant_menu_item_options.menu_item_id
        and i.active
        and i.available
        and s.ordering_enabled
    )
  )
  or exists (
    select 1
    from public.restaurant_menu_items i
    join public.supplier_accounts sa on sa.business_id = i.business_id
    where i.id = restaurant_menu_item_options.menu_item_id
      and sa.user_id = (select auth.uid())
  )
);

create policy restaurant_options_supplier_insert
on public.restaurant_menu_item_options
for insert
to authenticated
with check (
  exists (
    select 1
    from public.restaurant_menu_items i
    join public.supplier_accounts sa on sa.business_id = i.business_id
    where i.id = restaurant_menu_item_options.menu_item_id
      and sa.user_id = (select auth.uid())
  )
);

create policy restaurant_options_supplier_update
on public.restaurant_menu_item_options
for update
to authenticated
using (
  exists (
    select 1
    from public.restaurant_menu_items i
    join public.supplier_accounts sa on sa.business_id = i.business_id
    where i.id = restaurant_menu_item_options.menu_item_id
      and sa.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.restaurant_menu_items i
    join public.supplier_accounts sa on sa.business_id = i.business_id
    where i.id = restaurant_menu_item_options.menu_item_id
      and sa.user_id = (select auth.uid())
  )
);

create policy restaurant_options_supplier_delete
on public.restaurant_menu_item_options
for delete
to authenticated
using (
  exists (
    select 1
    from public.restaurant_menu_items i
    join public.supplier_accounts sa on sa.business_id = i.business_id
    where i.id = restaurant_menu_item_options.menu_item_id
      and sa.user_id = (select auth.uid())
  )
);

-- Restaurant option values.
drop policy if exists restaurant_option_values_public_read on public.restaurant_menu_item_option_values;
drop policy if exists restaurant_option_values_supplier_manage on public.restaurant_menu_item_option_values;

create policy restaurant_option_values_anon_read
on public.restaurant_menu_item_option_values
for select
to anon
using (
  active
  and exists (
    select 1
    from public.restaurant_menu_item_options o
    join public.restaurant_menu_items i on i.id = o.menu_item_id
    join public.restaurant_settings s on s.business_id = i.business_id
    where o.id = restaurant_menu_item_option_values.option_id
      and o.active
      and i.active
      and i.available
      and s.ordering_enabled
  )
);

create policy restaurant_option_values_authenticated_read
on public.restaurant_menu_item_option_values
for select
to authenticated
using (
  (
    active
    and exists (
      select 1
      from public.restaurant_menu_item_options o
      join public.restaurant_menu_items i on i.id = o.menu_item_id
      join public.restaurant_settings s on s.business_id = i.business_id
      where o.id = restaurant_menu_item_option_values.option_id
        and o.active
        and i.active
        and i.available
        and s.ordering_enabled
    )
  )
  or exists (
    select 1
    from public.restaurant_menu_item_options o
    join public.restaurant_menu_items i on i.id = o.menu_item_id
    join public.supplier_accounts sa on sa.business_id = i.business_id
    where o.id = restaurant_menu_item_option_values.option_id
      and sa.user_id = (select auth.uid())
  )
);

create policy restaurant_option_values_supplier_insert
on public.restaurant_menu_item_option_values
for insert
to authenticated
with check (
  exists (
    select 1
    from public.restaurant_menu_item_options o
    join public.restaurant_menu_items i on i.id = o.menu_item_id
    join public.supplier_accounts sa on sa.business_id = i.business_id
    where o.id = restaurant_menu_item_option_values.option_id
      and sa.user_id = (select auth.uid())
  )
);

create policy restaurant_option_values_supplier_update
on public.restaurant_menu_item_option_values
for update
to authenticated
using (
  exists (
    select 1
    from public.restaurant_menu_item_options o
    join public.restaurant_menu_items i on i.id = o.menu_item_id
    join public.supplier_accounts sa on sa.business_id = i.business_id
    where o.id = restaurant_menu_item_option_values.option_id
      and sa.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.restaurant_menu_item_options o
    join public.restaurant_menu_items i on i.id = o.menu_item_id
    join public.supplier_accounts sa on sa.business_id = i.business_id
    where o.id = restaurant_menu_item_option_values.option_id
      and sa.user_id = (select auth.uid())
  )
);

create policy restaurant_option_values_supplier_delete
on public.restaurant_menu_item_option_values
for delete
to authenticated
using (
  exists (
    select 1
    from public.restaurant_menu_item_options o
    join public.restaurant_menu_items i on i.id = o.menu_item_id
    join public.supplier_accounts sa on sa.business_id = i.business_id
    where o.id = restaurant_menu_item_option_values.option_id
      and sa.user_id = (select auth.uid())
  )
);
