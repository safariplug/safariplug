-- Track the production schema needed to place restaurant food orders on trip itineraries.
insert into public.inventory_kinds (slug, label, group_name)
values ('food_order', 'Food order', 'Dining')
on conflict (slug) do nothing;

alter table public.trip_items
  add column if not exists food_order_id uuid references public.food_orders(id) on delete set null;

create index if not exists trip_items_food_order_id_idx
  on public.trip_items(food_order_id);
