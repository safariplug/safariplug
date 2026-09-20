drop policy if exists "drivers read own transfer requests" on public.driver_transfer_requests;
drop policy if exists "travelers read own transfer requests" on public.driver_transfer_requests;

create policy "transfer request participant read"
on public.driver_transfer_requests
for select
to authenticated
using (
  traveler_id = (select auth.uid())
  or exists (
    select 1
    from public.driver_profiles d
    where d.id = driver_transfer_requests.driver_id
      and d.user_id = (select auth.uid())
  )
);

drop policy if exists "locals respond to own local requests" on public.local_requests;
drop policy if exists "travelers cancel own local requests" on public.local_requests;

create policy "local request participant update"
on public.local_requests
for update
to authenticated
using (
  traveler_id = (select auth.uid())
  or exists (
    select 1
    from public.local_profiles p
    where p.id = local_requests.local_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  (
    traveler_id = (select auth.uid())
    and status = 'cancelled'
  )
  or (
    exists (
      select 1
      from public.local_profiles p
      where p.id = local_requests.local_id
        and p.user_id = (select auth.uid())
    )
    and status in ('accepted','declined')
  )
);

drop policy if exists food_orders_customer_read on public.food_orders;
drop policy if exists food_orders_supplier_read on public.food_orders;

create policy food_orders_participant_read
on public.food_orders
for select
to authenticated
using (
  customer_user_id = (select auth.uid())
  or exists (
    select 1
    from public.supplier_accounts sa
    where sa.user_id = (select auth.uid())
      and sa.business_id = food_orders.business_id
  )
);

drop policy if exists food_order_items_customer_read on public.food_order_items;
drop policy if exists food_order_items_supplier_read on public.food_order_items;

create policy food_order_items_participant_read
on public.food_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.food_orders o
    where o.id = food_order_items.order_id
      and o.customer_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.food_orders o
    join public.supplier_accounts sa on sa.business_id = o.business_id
    where o.id = food_order_items.order_id
      and sa.user_id = (select auth.uid())
  )
);

drop policy if exists food_order_item_options_customer_read on public.food_order_item_options;
drop policy if exists food_order_item_options_supplier_read on public.food_order_item_options;

create policy food_order_item_options_participant_read
on public.food_order_item_options
for select
to authenticated
using (
  exists (
    select 1
    from public.food_order_items oi
    join public.food_orders o on o.id = oi.order_id
    where oi.id = food_order_item_options.order_item_id
      and o.customer_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.food_order_items oi
    join public.food_orders o on o.id = oi.order_id
    join public.supplier_accounts sa on sa.business_id = o.business_id
    where oi.id = food_order_item_options.order_item_id
      and sa.user_id = (select auth.uid())
  )
);
