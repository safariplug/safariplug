create table if not exists public.driver_transfer_rates (
 id uuid primary key default gen_random_uuid(), driver_id uuid not null references public.driver_profiles(id) on delete cascade,
 rate_type text not null check (rate_type in ('flat_route','airport_transfer','hourly','daily')),
 origin_label text, destination_label text, airport_code text,
 amount numeric(12,2) not null check (amount >= 0), currency text not null default 'KES',
 included_km numeric(10,2), extra_km_amount numeric(12,2),
 status text not null default 'draft' check (status in ('draft','active','paused')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists driver_transfer_rates_driver_idx on public.driver_transfer_rates(driver_id,status);

create table if not exists public.driver_transfer_requests (
 id uuid primary key default gen_random_uuid(), traveler_id uuid not null references auth.users(id) on delete cascade,
 driver_id uuid not null references public.driver_profiles(id) on delete restrict,
 transfer_rate_id uuid references public.driver_transfer_rates(id) on delete set null,
 trip_id uuid references public.trips(id) on delete set null,
 pickup_label text not null, destination_label text not null,
 requested_at timestamptz not null,
 passenger_count integer not null default 1 check (passenger_count > 0 and passenger_count <= 50), notes text,
 quoted_amount numeric(12,2), currency text not null default 'KES',
 status text not null default 'requested' check (status in ('requested','accepted','declined','cancelled','completed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists driver_transfer_requests_traveler_idx on public.driver_transfer_requests(traveler_id,created_at desc);
create index if not exists driver_transfer_requests_driver_idx on public.driver_transfer_requests(driver_id,status,requested_at);
alter table public.driver_transfer_rates enable row level security;
alter table public.driver_transfer_requests enable row level security;
create policy "public reads eligible active transfer rates" on public.driver_transfer_rates for select using (status='active' and exists(select 1 from public.driver_profiles d where d.id=driver_id and d.service_status='active' and d.verification_state='verified' and d.driving_license_compliance_status in ('valid','expiring_soon')));
create policy "drivers manage own transfer rates" on public.driver_transfer_rates for all to authenticated using (exists(select 1 from public.driver_profiles d where d.id=driver_id and d.user_id=auth.uid())) with check (exists(select 1 from public.driver_profiles d where d.id=driver_id and d.user_id=auth.uid()));
create policy "travelers read own transfer requests" on public.driver_transfer_requests for select to authenticated using (traveler_id=auth.uid());
create policy "drivers read own transfer requests" on public.driver_transfer_requests for select to authenticated using (exists(select 1 from public.driver_profiles d where d.id=driver_id and d.user_id=auth.uid()));
create policy "travelers create eligible transfer requests" on public.driver_transfer_requests for insert to authenticated with check (traveler_id=auth.uid() and requested_at > now() and exists(select 1 from public.driver_profiles d where d.id=driver_id and d.service_status='active' and d.verification_state='verified' and d.driving_license_compliance_status in ('valid','expiring_soon')) and (trip_id is null or exists(select 1 from public.trips t where t.id=trip_id and t.traveler_id=auth.uid())));
create policy "travelers cancel own transfer requests" on public.driver_transfer_requests for update to authenticated using (traveler_id=auth.uid() and status='requested') with check (traveler_id=auth.uid() and status='cancelled');
