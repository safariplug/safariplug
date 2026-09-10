alter table public.food_orders
  add column if not exists trip_id uuid references public.trips(id) on delete set null;

create index if not exists food_orders_trip_id_idx
  on public.food_orders(trip_id);
