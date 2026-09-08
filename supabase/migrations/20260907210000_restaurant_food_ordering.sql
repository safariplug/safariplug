-- SafariPlug restaurant ordering foundation
-- Menus are separate from appointment/service offerings so food orders can contain
-- multiple items, modifiers, and a delivery workflow.

create table if not exists public.restaurant_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  ordering_enabled boolean not null default false,
  pickup_enabled boolean not null default true,
  safari_driver_enabled boolean not null default false,
  customer_driver_enabled boolean not null default true,
  restaurant_delivery_enabled boolean not null default false,
  restaurant_delivery_fee numeric(12,2) not null default 0,
  free_delivery_threshold numeric(12,2),
  minimum_order_amount numeric(12,2) not null default 0,
  preparation_time_minutes integer not null default 30,
  ordering_notice_minutes integer not null default 0,
  timezone text not null default 'Africa/Nairobi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_settings_fees_nonnegative check (restaurant_delivery_fee >= 0 and minimum_order_amount >= 0),
  constraint restaurant_settings_prep_positive check (preparation_time_minutes > 0)
);

create table if not exists public.restaurant_menu_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.restaurant_menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.restaurant_menu_categories(id) on delete set null,
  name text not null,
  description text,
  image_url text,
  price numeric(12,2) not null,
  currency text not null default 'KES',
  preparation_time_minutes integer,
  sort_order integer not null default 0,
  available boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_menu_items_price_nonnegative check (price >= 0),
  constraint restaurant_menu_items_prep_nonnegative check (preparation_time_minutes is null or preparation_time_minutes > 0)
);

create table if not exists public.restaurant_menu_item_options (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.restaurant_menu_items(id) on delete cascade,
  name text not null,
  required boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (menu_item_id, name)
);

create table if not exists public.restaurant_menu_item_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.restaurant_menu_item_options(id) on delete cascade,
  name text not null,
  price_delta numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (option_id, name)
);

create table if not exists public.food_orders (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default ('FOOD-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  fulfillment_method text not null default 'pickup',
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  payment_reference text,
  currency text not null default 'KES',
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  service_fee numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  customer_total numeric(12,2) not null default 0,
  pickup_address text,
  delivery_address text,
  delivery_latitude numeric,
  delivery_longitude numeric,
  customer_notes text,
  restaurant_notes text,
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_orders_fulfillment_method check (fulfillment_method in ('pickup','safari_driver','customer_driver','restaurant_delivery')),
  constraint food_orders_status check (status in ('pending','accepted','preparing','ready','driver_assigned','picked_up','on_the_way','delivered','cancelled','rejected')),
  constraint food_orders_payment_status check (payment_status in ('unpaid','pending','paid','failed','refunded')),
  constraint food_orders_amounts_nonnegative check (subtotal >= 0 and delivery_fee >= 0 and service_fee >= 0 and discount_amount >= 0 and customer_total >= 0)
);

create table if not exists public.food_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.food_orders(id) on delete cascade,
  menu_item_id uuid references public.restaurant_menu_items(id) on delete set null,
  item_name text not null,
  unit_price numeric(12,2) not null,
  quantity integer not null,
  line_total numeric(12,2) not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint food_order_items_quantity_positive check (quantity > 0),
  constraint food_order_items_amounts_nonnegative check (unit_price >= 0 and line_total >= 0)
);

create table if not exists public.food_order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.food_order_items(id) on delete cascade,
  option_name text not null,
  value_name text not null,
  price_delta numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.food_delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.food_orders(id) on delete cascade,
  driver_id uuid not null references public.driver_profiles(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  assignment_source text not null default 'safariplug',
  status text not null default 'assigned',
  delivery_fee numeric(12,2) not null default 0,
  assigned_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_delivery_assignment_source check (assignment_source in ('safariplug','customer','restaurant')),
  constraint food_delivery_assignment_status check (status in ('assigned','accepted','declined','arrived_at_restaurant','picked_up','on_the_way','delivered','cancelled')),
  constraint food_delivery_assignment_fee_nonnegative check (delivery_fee >= 0)
);

create index if not exists idx_restaurant_menu_categories_business on public.restaurant_menu_categories(business_id, active, sort_order);
create index if not exists idx_restaurant_menu_items_business on public.restaurant_menu_items(business_id, active, available, sort_order);
create index if not exists idx_restaurant_menu_items_category on public.restaurant_menu_items(category_id, active, sort_order);
create index if not exists idx_food_orders_business on public.food_orders(business_id, status, created_at desc);
create index if not exists idx_food_orders_customer on public.food_orders(customer_user_id, created_at desc);
create index if not exists idx_food_order_items_order on public.food_order_items(order_id);
create index if not exists idx_food_delivery_assignments_driver on public.food_delivery_assignments(driver_id, status);

alter table public.restaurant_settings enable row level security;
alter table public.restaurant_menu_categories enable row level security;
alter table public.restaurant_menu_items enable row level security;
alter table public.restaurant_menu_item_options enable row level security;
alter table public.restaurant_menu_item_option_values enable row level security;
alter table public.food_orders enable row level security;
alter table public.food_order_items enable row level security;
alter table public.food_order_item_options enable row level security;
alter table public.food_delivery_assignments enable row level security;

-- Public customers may read only active menu content for restaurants that have ordering enabled.
create policy restaurant_menu_categories_public_read on public.restaurant_menu_categories
  for select to anon, authenticated
  using (active and exists (select 1 from public.restaurant_settings s where s.business_id = business_id and s.ordering_enabled));

create policy restaurant_menu_items_public_read on public.restaurant_menu_items
  for select to anon, authenticated
  using (active and available and exists (select 1 from public.restaurant_settings s where s.business_id = business_id and s.ordering_enabled));

create policy restaurant_menu_options_public_read on public.restaurant_menu_item_options
  for select to anon, authenticated
  using (active and exists (select 1 from public.restaurant_menu_items i join public.restaurant_settings s on s.business_id = i.business_id where i.id = menu_item_id and i.active and i.available and s.ordering_enabled));

create policy restaurant_menu_option_values_public_read on public.restaurant_menu_item_option_values
  for select to anon, authenticated
  using (active and exists (select 1 from public.restaurant_menu_item_options o join public.restaurant_menu_items i on i.id = o.menu_item_id join public.restaurant_settings s on s.business_id = i.business_id where o.id = option_id and o.active and i.active and i.available and s.ordering_enabled));

-- Suppliers manage only their own restaurant records.
create policy restaurant_settings_supplier_manage on public.restaurant_settings
  for all to authenticated
  using (exists (select 1 from public.supplier_accounts sa where sa.user_id = auth.uid() and sa.business_id = business_id))
  with check (exists (select 1 from public.supplier_accounts sa where sa.user_id = auth.uid() and sa.business_id = business_id));

create policy restaurant_categories_supplier_manage on public.restaurant_menu_categories
  for all to authenticated
  using (exists (select 1 from public.supplier_accounts sa where sa.user_id = auth.uid() and sa.business_id = business_id))
  with check (exists (select 1 from public.supplier_accounts sa where sa.user_id = auth.uid() and sa.business_id = business_id));

create policy restaurant_items_supplier_manage on public.restaurant_menu_items
  for all to authenticated
  using (exists (select 1 from public.supplier_accounts sa where sa.user_id = auth.uid() and sa.business_id = business_id))
  with check (exists (select 1 from public.supplier_accounts sa where sa.user_id = auth.uid() and sa.business_id = business_id));

create policy restaurant_options_supplier_manage on public.restaurant_menu_item_options
  for all to authenticated
  using (exists (select 1 from public.restaurant_menu_items i join public.supplier_accounts sa on sa.business_id = i.business_id where i.id = menu_item_id and sa.user_id = auth.uid()))
  with check (exists (select 1 from public.restaurant_menu_items i join public.supplier_accounts sa on sa.business_id = i.business_id where i.id = menu_item_id and sa.user_id = auth.uid()));

create policy restaurant_option_values_supplier_manage on public.restaurant_menu_item_option_values
  for all to authenticated
  using (exists (select 1 from public.restaurant_menu_item_options o join public.restaurant_menu_items i on i.id = o.menu_item_id join public.supplier_accounts sa on sa.business_id = i.business_id where o.id = option_id and sa.user_id = auth.uid()))
  with check (exists (select 1 from public.restaurant_menu_item_options o join public.restaurant_menu_items i on i.id = o.menu_item_id join public.supplier_accounts sa on sa.business_id = i.business_id where o.id = option_id and sa.user_id = auth.uid()));

-- Customers can see their own orders; suppliers can manage orders for their restaurants.
create policy food_orders_customer_read on public.food_orders
  for select to authenticated
  using (customer_user_id = auth.uid());

create policy food_orders_customer_insert on public.food_orders
  for insert to authenticated
  with check (customer_user_id = auth.uid());

create policy food_orders_supplier_read on public.food_orders
  for select to authenticated
  using (exists (select 1 from public.supplier_accounts sa where sa.user_id = auth.uid() and sa.business_id = business_id));

create policy food_orders_supplier_update on public.food_orders
  for update to authenticated
  using (exists (select 1 from public.supplier_accounts sa where sa.user_id = auth.uid() and sa.business_id = business_id))
  with check (exists (select 1 from public.supplier_accounts sa where sa.user_id = auth.uid() and sa.business_id = business_id));

create policy food_order_items_customer_read on public.food_order_items
  for select to authenticated
  using (exists (select 1 from public.food_orders o where o.id = order_id and o.customer_user_id = auth.uid()));

create policy food_order_items_supplier_read on public.food_order_items
  for select to authenticated
  using (exists (select 1 from public.food_orders o join public.supplier_accounts sa on sa.business_id = o.business_id where o.id = order_id and sa.user_id = auth.uid()));

create policy food_order_item_options_customer_read on public.food_order_item_options
  for select to authenticated
  using (exists (select 1 from public.food_order_items oi join public.food_orders o on o.id = oi.order_id where oi.id = order_item_id and o.customer_user_id = auth.uid()));

create policy food_order_item_options_supplier_read on public.food_order_item_options
  for select to authenticated
  using (exists (select 1 from public.food_order_items oi join public.food_orders o on o.id = oi.order_id join public.supplier_accounts sa on sa.business_id = o.business_id where oi.id = order_item_id and sa.user_id = auth.uid()));

create policy food_delivery_supplier_manage on public.food_delivery_assignments
  for all to authenticated
  using (exists (select 1 from public.food_orders o join public.supplier_accounts sa on sa.business_id = o.business_id where o.id = order_id and sa.user_id = auth.uid()))
  with check (exists (select 1 from public.food_orders o join public.supplier_accounts sa on sa.business_id = o.business_id where o.id = order_id and sa.user_id = auth.uid()));

create policy food_delivery_customer_read on public.food_delivery_assignments
  for select to authenticated
  using (exists (select 1 from public.food_orders o where o.id = order_id and o.customer_user_id = auth.uid()));

create policy food_delivery_driver_read on public.food_delivery_assignments
  for select to authenticated
  using (exists (select 1 from public.driver_profiles d where d.id = driver_id and d.user_id = auth.uid()));

create policy food_delivery_driver_update on public.food_delivery_assignments
  for update to authenticated
  using (exists (select 1 from public.driver_profiles d where d.id = driver_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.driver_profiles d where d.id = driver_id and d.user_id = auth.uid()));

-- Keep updated_at current without requiring application code to do so.
create or replace function public.set_restaurant_food_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists restaurant_settings_updated_at on public.restaurant_settings;
create trigger restaurant_settings_updated_at before update on public.restaurant_settings for each row execute function public.set_restaurant_food_updated_at();
drop trigger if exists restaurant_menu_categories_updated_at on public.restaurant_menu_categories;
create trigger restaurant_menu_categories_updated_at before update on public.restaurant_menu_categories for each row execute function public.set_restaurant_food_updated_at();
drop trigger if exists restaurant_menu_items_updated_at on public.restaurant_menu_items;
create trigger restaurant_menu_items_updated_at before update on public.restaurant_menu_items for each row execute function public.set_restaurant_food_updated_at();
drop trigger if exists food_orders_updated_at on public.food_orders;
create trigger food_orders_updated_at before update on public.food_orders for each row execute function public.set_restaurant_food_updated_at();
drop trigger if exists food_delivery_assignments_updated_at on public.food_delivery_assignments;
create trigger food_delivery_assignments_updated_at before update on public.food_delivery_assignments for each row execute function public.set_restaurant_food_updated_at();
