create table if not exists public.marketplace_conversion_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in ('marketplace_view','product_view','trip_add','checkout_start')),
  surface text not null,
  session_id text not null,
  traveler_id uuid null references auth.users(id) on delete set null,
  product_ref text null,
  trip_id uuid null references public.trips(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_conversion_events_time_idx on public.marketplace_conversion_events (created_at desc);
create index if not exists marketplace_conversion_events_surface_idx on public.marketplace_conversion_events (surface,event_name,created_at desc);
alter table public.marketplace_conversion_events enable row level security;
drop policy if exists "marketplace_conversion_events_no_direct_access" on public.marketplace_conversion_events;
create policy "marketplace_conversion_events_no_direct_access" on public.marketplace_conversion_events for all using (false) with check (false);
