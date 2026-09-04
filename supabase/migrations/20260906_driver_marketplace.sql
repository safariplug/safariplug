-- Additive driver marketplace. Does not alter events, cities, hotels,
-- transfer adapters, or existing booking RLS.
-- No production rows are inserted. Do not mark drivers verified.

create table if not exists public.driver_profiles (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers(id) on delete set null,
  provider_type text not null default 'independent_driver'
    check (provider_type = any (array[
      'independent_driver'::text,
      'safariplug_driver'::text,
      'transport_company'::text,
      'hotel_driver'::text,
      'tour_operator'::text,
      'aurelian_driver'::text,
      'external_driver_provider'::text
    ])),
  display_name text not null,
  contact_ref text,
  service_status text not null default 'pending'
    check (service_status = any (array[
      'pending'::text,
      'active'::text,
      'inactive'::text,
      'suspended'::text,
      'off_duty'::text
    ])),
  verification_state text not null default 'unverified'
    check (verification_state = any (array[
      'unverified'::text,
      'pending'::text,
      'verified'::text,
      'rejected'::text
    ])),
  preferred boolean not null default false,
  capabilities text[] not null default '{}',
  service_country text,
  service_region text,
  service_city_id uuid references public.cities(id) on delete set null,
  service_city text,
  service_airport_code text,
  service_lat numeric,
  service_lng numeric,
  service_radius_km numeric,
  source text not null default 'safariplug',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_profiles_status_idx
  on public.driver_profiles (service_status, verification_state);
create index if not exists driver_profiles_provider_idx
  on public.driver_profiles (provider_id);
create unique index if not exists driver_profiles_source_external_id_idx
  on public.driver_profiles (source, external_id)
  where external_id is not null;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers(id) on delete set null,
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  category text,
  make_model text,
  passenger_capacity integer,
  luggage_capacity integer,
  accessibility boolean not null default false,
  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'active'::text,
      'inactive'::text,
      'retired'::text
    ])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicles_driver_idx on public.vehicles (driver_id);

create table if not exists public.driver_availability (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  available_on date not null,
  start_time time,
  end_time time,
  timezone text not null default 'Africa/Nairobi',
  status text not null default 'available'
    check (status = any (array[
      'available'::text,
      'unavailable'::text,
      'off_duty'::text,
      'assigned'::text
    ])),
  created_at timestamptz not null default now()
);

create index if not exists driver_availability_driver_date_idx
  on public.driver_availability (driver_id, available_on);

create table if not exists public.driver_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  driver_id uuid not null references public.driver_profiles(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  status text not null default 'assigned'
    check (status = any (array[
      'assigned'::text,
      'reassigned'::text,
      'accepted'::text,
      'declined'::text,
      'cancelled'::text,
      'released'::text,
      'completed'::text
    ])),
  assigned_by text not null default 'system'
    check (assigned_by = any (array['admin'::text, 'system'::text, 'provider'::text])),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_assignments_booking_idx
  on public.driver_assignments (booking_id, created_at desc);
create unique index if not exists driver_assignments_active_booking_uidx
  on public.driver_assignments (booking_id)
  where status = any (array['assigned'::text, 'accepted'::text]);

-- Verification is a later phase. This trigger refuses verified rows until
-- a dedicated verification migration replaces it.
create or replace function public.driver_forbid_verified()
returns trigger
language plpgsql
as $$
begin
  if NEW.verification_state = 'verified' then
    raise exception 'Driver verification is not enabled. Unverified drivers cannot become bookable.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists driver_profiles_forbid_verified on public.driver_profiles;
create trigger driver_profiles_forbid_verified
  before insert or update of verification_state on public.driver_profiles
  for each row execute procedure public.driver_forbid_verified();

-- Assignment rows must not mutate booking.status.
create or replace function public.driver_assignment_booking_must_exist()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.bookings b
    where b.id = NEW.booking_id
      and b.status = any (array['confirmed'::text, 'booked'::text])
  ) then
    raise exception 'Driver assignment requires a confirmed or booked transfer';
  end if;
  return NEW;
end;
$$;

drop trigger if exists driver_assignments_require_booked on public.driver_assignments;
create trigger driver_assignments_require_booked
  before insert on public.driver_assignments
  for each row execute procedure public.driver_assignment_booking_must_exist();

alter table public.driver_profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.driver_availability enable row level security;
alter table public.driver_assignments enable row level security;

-- No anon/authenticated policies: deny by default.
revoke all on table public.driver_profiles from anon, authenticated;
revoke all on table public.vehicles from anon, authenticated;
revoke all on table public.driver_availability from anon, authenticated;
revoke all on table public.driver_assignments from anon, authenticated;

grant all on table public.driver_profiles to service_role;
grant all on table public.vehicles to service_role;
grant all on table public.driver_availability to service_role;
grant all on table public.driver_assignments to service_role;

comment on table public.driver_profiles is
  'Driver marketplace profiles. Empty until real drivers exist. verification_state cannot be verified in this phase.';
comment on table public.driver_assignments is
  'Links a confirmed/booked transfer to a driver. Does not change bookings.status.';
comment on column public.driver_profiles.contact_ref is
  'Opaque contact reference. Never expose through public APIs.';
