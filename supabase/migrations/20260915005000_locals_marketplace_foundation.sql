create table if not exists public.local_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  bio text,
  personal_photo_url text,
  city text,
  country text,
  languages text[] not null default '{}',
  interests text[] not null default '{}',
  specialties text[] not null default '{}',
  hourly_rate numeric(12,2),
  currency text not null default 'USD',
  timezone text not null default 'Africa/Nairobi',
  verification_state text not null default 'unverified' check (verification_state in ('unverified','pending','verified','rejected','expired')),
  service_status text not null default 'draft' check (service_status in ('draft','pending_review','active','paused','suspended')),
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint local_profiles_rate_nonnegative check (hourly_rate is null or hourly_rate >= 0)
);

create table if not exists public.local_availability (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.local_profiles(id) on delete cascade,
  available_on date not null,
  start_time time,
  end_time time,
  timezone text not null default 'Africa/Nairobi',
  status text not null default 'available' check (status in ('available','unavailable')),
  created_at timestamptz not null default now(),
  unique(local_id, available_on, start_time, end_time)
);

create table if not exists public.local_requests (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references auth.users(id) on delete cascade,
  local_id uuid not null references public.local_profiles(id) on delete restrict,
  trip_id uuid references public.trips(id) on delete set null,
  requested_start_at timestamptz not null,
  requested_end_at timestamptz,
  city text,
  activity text,
  notes text,
  quoted_amount numeric(12,2),
  currency text not null default 'USD',
  status text not null default 'requested' check (status in ('requested','accepted','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint local_requests_quote_nonnegative check (quoted_amount is null or quoted_amount >= 0),
  constraint local_requests_time_order check (requested_end_at is null or requested_end_at > requested_start_at)
);

alter table public.trip_items add column if not exists local_request_id uuid references public.local_requests(id) on delete set null;

create index if not exists local_profiles_public_idx on public.local_profiles(service_status, verification_state, city);
create index if not exists local_availability_lookup_idx on public.local_availability(local_id, available_on, status);
create index if not exists local_requests_traveler_idx on public.local_requests(traveler_id, created_at desc);
create index if not exists local_requests_local_idx on public.local_requests(local_id, created_at desc);
create index if not exists local_requests_trip_idx on public.local_requests(trip_id) where trip_id is not null;
create index if not exists trip_items_local_request_idx on public.trip_items(local_request_id) where local_request_id is not null;

alter table public.local_profiles enable row level security;
alter table public.local_availability enable row level security;
alter table public.local_requests enable row level security;

grant select, insert, update on public.local_profiles to authenticated;
grant select, insert, update, delete on public.local_availability to authenticated;
grant select, insert, update on public.local_requests to authenticated;
grant select on public.local_profiles to anon;
grant select on public.local_availability to anon;

create policy "anonymous can view active verified locals" on public.local_profiles for select to anon using (service_status='active' and verification_state='verified');
create policy "locals profile read access" on public.local_profiles for select to authenticated using ((service_status='active' and verification_state='verified') or (select auth.uid())=user_id);
create policy "locals can create own profile" on public.local_profiles for insert to authenticated with check ((select auth.uid())=user_id and verification_state='unverified' and service_status='draft');
create policy "locals can update own non-active profile" on public.local_profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id and service_status <> 'active' and verification_state <> 'verified');

create policy "anonymous can view verified local availability" on public.local_availability for select to anon using (exists (select 1 from public.local_profiles p where p.id=local_id and p.service_status='active' and p.verification_state='verified'));
create policy "authenticated local availability read" on public.local_availability for select to authenticated using (exists (select 1 from public.local_profiles p where p.id=local_id and ((p.service_status='active' and p.verification_state='verified') or p.user_id=(select auth.uid()))));
create policy "locals insert own availability" on public.local_availability for insert to authenticated with check (exists (select 1 from public.local_profiles p where p.id=local_id and p.user_id=(select auth.uid())));
create policy "locals update own availability" on public.local_availability for update to authenticated using (exists (select 1 from public.local_profiles p where p.id=local_id and p.user_id=(select auth.uid()))) with check (exists (select 1 from public.local_profiles p where p.id=local_id and p.user_id=(select auth.uid())));
create policy "locals delete own availability" on public.local_availability for delete to authenticated using (exists (select 1 from public.local_profiles p where p.id=local_id and p.user_id=(select auth.uid())));

create policy "travelers create own local requests" on public.local_requests for insert to authenticated with check ((select auth.uid())=traveler_id and exists (select 1 from public.local_profiles p where p.id=local_id and p.service_status='active' and p.verification_state='verified') and (trip_id is null or exists (select 1 from public.trips t where t.id=trip_id and t.traveler_id=(select auth.uid()))));
create policy "local request participant read" on public.local_requests for select to authenticated using ((select auth.uid())=traveler_id or exists (select 1 from public.local_profiles p where p.id=local_id and p.user_id=(select auth.uid())));
create policy "travelers cancel own local requests" on public.local_requests for update to authenticated using ((select auth.uid())=traveler_id) with check ((select auth.uid())=traveler_id and status='cancelled');
