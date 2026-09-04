-- Additive Travel OS foundation. Does not alter public.events or cities.
-- No production data is rewritten. Empty inventory tables are expected.
-- Event FKs use ON DELETE SET NULL so Travel OS rows cannot delete live events.

create table if not exists public.inventory_kinds (
  slug text primary key,
  label text not null,
  group_name text not null
);

insert into public.inventory_kinds (slug, label, group_name) values
  ('hotel', 'Hotel', 'stay'),
  ('safari', 'Safari', 'experience'),
  ('experience', 'Experience', 'experience'),
  ('event', 'Event', 'experience'),
  ('restaurant', 'Restaurant', 'experience'),
  ('attraction', 'Attraction', 'experience'),
  ('tour', 'Tour', 'experience'),
  ('activity', 'Activity', 'experience'),
  ('adventure', 'Adventure activity', 'experience'),
  ('transfer', 'Transfer', 'move'),
  ('driver', 'Driver', 'move'),
  ('vehicle', 'Vehicle', 'move'),
  ('personal_service', 'Personal service', 'service'),
  ('other', 'Other', 'other')
on conflict (slug) do nothing;

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  kind text not null default 'business'
    check (kind = any (array['business'::text, 'individual'::text])),
  provider_type text not null default 'other',
  status text not null default 'draft'
    check (status = any (array['draft'::text, 'pending'::text, 'active'::text, 'suspended'::text, 'archived'::text])),
  verification_status text not null default 'unverified'
    check (verification_status = any (array['unverified'::text, 'pending'::text, 'verified'::text, 'rejected'::text])),
  city_id uuid references public.cities(id) on delete set null,
  location_label text,
  service_area text,
  capabilities text[] not null default '{}',
  external_id text,
  source text not null default 'safariplug',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists providers_status_idx on public.providers (status);
create index if not exists providers_city_idx on public.providers (city_id);
create index if not exists providers_type_idx on public.providers (provider_type);
create unique index if not exists providers_source_external_id_idx
  on public.providers (source, external_id)
  where external_id is not null;

create table if not exists public.offerings (
  id uuid primary key default gen_random_uuid(),
  kind text not null references public.inventory_kinds(slug),
  provider_id uuid references public.providers(id) on delete set null,
  event_id uuid unique references public.events(id) on delete set null,
  title text not null,
  description text,
  city_id uuid references public.cities(id) on delete set null,
  category text,
  status text not null default 'draft'
    check (status = any (array['draft'::text, 'pending'::text, 'approved'::text, 'archived'::text])),
  start_at timestamptz,
  end_at timestamptz,
  source text not null default 'safariplug',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists offerings_status_kind_idx on public.offerings (status, kind);
create index if not exists offerings_provider_idx on public.offerings (provider_id);
create index if not exists offerings_city_idx on public.offerings (city_id);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null,
  title text,
  destination_city_id uuid references public.cities(id) on delete set null,
  start_on date,
  end_on date,
  status text not null default 'draft'
    check (status = any (array['draft'::text, 'planned'::text, 'booked'::text, 'active'::text, 'completed'::text, 'cancelled'::text])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_traveler_idx on public.trips (traveler_id, created_at desc);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  traveler_id uuid not null,
  trip_id uuid references public.trips(id) on delete set null,
  offering_id uuid references public.offerings(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  provider_id uuid references public.providers(id) on delete set null,
  status text not null default 'quote'
    check (status = any (array[
      'search'::text,
      'availability'::text,
      'quote'::text,
      'hold'::text,
      'confirmed'::text,
      'booked'::text,
      'modified'::text,
      'cancelled'::text,
      'completed'::text
    ])),
  idempotency_key text unique,
  supplier_amount numeric,
  supplier_currency text,
  markup_amount numeric not null default 0,
  commission_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  fee_amount numeric not null default 0,
  customer_total numeric,
  customer_currency text,
  price_source text not null default 'unconfirmed_listed'
    check (price_source = any (array[
      'unconfirmed_listed'::text,
      'safariplug_calc'::text,
      'supplier'::text
    ])),
  supplier_reference text,
  notes text,
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (event_id is not null or offering_id is not null)
);

create index if not exists bookings_traveler_idx on public.bookings (traveler_id, created_at desc);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_event_idx on public.bookings (event_id);

create table if not exists public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  offering_id uuid references public.offerings(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  item_kind text not null references public.inventory_kinds(slug),
  position integer not null default 0,
  start_at timestamptz,
  end_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_items_trip_idx on public.trip_items (trip_id, position);
create unique index if not exists trip_items_trip_event_uidx
  on public.trip_items (trip_id, event_id)
  where event_id is not null;

create table if not exists public.booking_status_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists booking_status_events_booking_idx
  on public.booking_status_events (booking_id, created_at);

create table if not exists public.price_quotes (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid references public.offerings(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  supplier_amount numeric not null,
  supplier_currency text not null,
  markup_amount numeric not null default 0,
  commission_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  fee_amount numeric not null default 0,
  customer_total numeric not null,
  customer_currency text not null,
  source text not null default 'unconfirmed_listed',
  created_at timestamptz not null default now()
);

-- Server-side event/offering approval. Application checks are not sufficient
-- because the anon key + user JWT can insert directly under RLS.
create or replace function public.travel_os_require_approved_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.event_id is not null and not exists (
    select 1 from public.events e
    where e.id = NEW.event_id and e.status = 'approved'
  ) then
    raise exception 'Only approved events can be referenced by Travel OS records';
  end if;
  return NEW;
end;
$$;

create or replace function public.travel_os_require_approved_offering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.offering_id is not null and not exists (
    select 1 from public.offerings o
    where o.id = NEW.offering_id and o.status = 'approved'
  ) then
    raise exception 'Only approved offerings can be referenced by Travel OS records';
  end if;
  return NEW;
end;
$$;

-- Authenticated clients cannot self-advance a quote to booked/confirmed.
create or replace function public.travel_os_lock_user_booking()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    NEW.status := 'quote';
    NEW.supplier_reference := null;
    if NEW.price_source = 'supplier' then
      NEW.price_source := 'unconfirmed_listed';
    end if;
  end if;
  return NEW;
end;
$$;

create or replace function public.travel_os_log_booking_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, note)
    values (
      NEW.id,
      null,
      NEW.status,
      NEW.traveler_id,
      'Quote created. Provider confirmation is not available.'
    );
  elsif TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then
    insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, note)
    values (NEW.id, OLD.status, NEW.status, auth.uid(), 'status change');
  end if;
  return NEW;
end;
$$;

drop trigger if exists travel_os_offerings_approved_event on public.offerings;
create trigger travel_os_offerings_approved_event
  before insert or update of event_id on public.offerings
  for each row execute procedure public.travel_os_require_approved_event();

drop trigger if exists travel_os_trip_items_approved_event on public.trip_items;
create trigger travel_os_trip_items_approved_event
  before insert or update of event_id on public.trip_items
  for each row execute procedure public.travel_os_require_approved_event();

drop trigger if exists travel_os_trip_items_approved_offering on public.trip_items;
create trigger travel_os_trip_items_approved_offering
  before insert or update of offering_id on public.trip_items
  for each row execute procedure public.travel_os_require_approved_offering();

drop trigger if exists travel_os_bookings_approved_event on public.bookings;
create trigger travel_os_bookings_approved_event
  before insert or update of event_id on public.bookings
  for each row execute procedure public.travel_os_require_approved_event();

drop trigger if exists travel_os_bookings_approved_offering on public.bookings;
create trigger travel_os_bookings_approved_offering
  before insert or update of offering_id on public.bookings
  for each row execute procedure public.travel_os_require_approved_offering();

drop trigger if exists travel_os_bookings_lock_user on public.bookings;
create trigger travel_os_bookings_lock_user
  before insert or update on public.bookings
  for each row execute procedure public.travel_os_lock_user_booking();

drop trigger if exists travel_os_bookings_audit on public.bookings;
create trigger travel_os_bookings_audit
  after insert or update of status on public.bookings
  for each row execute procedure public.travel_os_log_booking_status();

alter table public.inventory_kinds enable row level security;
alter table public.providers enable row level security;
alter table public.offerings enable row level security;
alter table public.trips enable row level security;
alter table public.trip_items enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_status_events enable row level security;
alter table public.price_quotes enable row level security;

drop policy if exists "Public can read inventory kinds" on public.inventory_kinds;
create policy "Public can read inventory kinds"
  on public.inventory_kinds for select using (true);

drop policy if exists "Public can read active providers" on public.providers;
create policy "Public can read active providers"
  on public.providers for select using (status = 'active');

drop policy if exists "Public can read approved offerings" on public.offerings;
create policy "Public can read approved offerings"
  on public.offerings for select using (status = 'approved');

drop policy if exists "Users read own trips" on public.trips;
create policy "Users read own trips"
  on public.trips for select using (auth.uid() = traveler_id);
drop policy if exists "Users insert own trips" on public.trips;
create policy "Users insert own trips"
  on public.trips for insert with check (
    auth.uid() = traveler_id
    and status = 'draft'
  );
drop policy if exists "Users update own trips" on public.trips;

drop policy if exists "Users read own trip items" on public.trip_items;
create policy "Users read own trip items"
  on public.trip_items for select
  using (exists (select 1 from public.trips t where t.id = trip_id and t.traveler_id = auth.uid()));
drop policy if exists "Users write own trip items" on public.trip_items;
create policy "Users write own trip items"
  on public.trip_items for insert
  with check (
    exists (select 1 from public.trips t where t.id = trip_id and t.traveler_id = auth.uid())
    and booking_id is null
  );

drop policy if exists "Users read own bookings" on public.bookings;
create policy "Users read own bookings"
  on public.bookings for select using (auth.uid() = traveler_id);
drop policy if exists "Users insert own bookings" on public.bookings;
create policy "Users insert own bookings"
  on public.bookings for insert with check (
    auth.uid() = traveler_id
    and status = 'quote'
    and supplier_reference is null
  );

drop policy if exists "Users read own booking audit" on public.booking_status_events;
create policy "Users read own booking audit"
  on public.booking_status_events for select
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.traveler_id = auth.uid()));

-- price_quotes: no public/authenticated policies. Server/service-role only.
-- No user UPDATE/DELETE policies on trips, bookings, or trip_items.

revoke all on table public.inventory_kinds from anon, authenticated;
revoke all on table public.providers from anon, authenticated;
revoke all on table public.offerings from anon, authenticated;
revoke all on table public.trips from anon, authenticated;
revoke all on table public.trip_items from anon, authenticated;
revoke all on table public.bookings from anon, authenticated;
revoke all on table public.booking_status_events from anon, authenticated;
revoke all on table public.price_quotes from anon, authenticated;

grant select on table public.inventory_kinds to anon, authenticated;
grant select on table public.providers to anon, authenticated;
grant select on table public.offerings to anon, authenticated;
grant select, insert on table public.trips to authenticated;
grant select, insert on table public.trip_items to authenticated;
grant select, insert on table public.bookings to authenticated;
grant select on table public.booking_status_events to authenticated;

grant all on table public.inventory_kinds to service_role;
grant all on table public.providers to service_role;
grant all on table public.offerings to service_role;
grant all on table public.trips to service_role;
grant all on table public.trip_items to service_role;
grant all on table public.bookings to service_role;
grant all on table public.booking_status_events to service_role;
grant all on table public.price_quotes to service_role;

comment on table public.offerings is
  'Provider inventory. Empty until real providers exist. Linking an event does not publish or book it.';
comment on table public.trip_items is
  'Trip graph items. Attaching an approved event does not make it bookable.';
comment on table public.bookings is
  'Booking records. Authenticated users may create quotes only. Confirm/hold/booked require a provider contract and service role.';
comment on column public.bookings.price_source is
  'unconfirmed_listed copies public event.price. It is not a supplier-confirmed rate.';
