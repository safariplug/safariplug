create table if not exists public.trip_package_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.trip_package_quotes(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  traveler_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'checking' check (status in ('checking','ready','confirmation_required','blocked','expired')),
  currency text not null,
  subtotal numeric(14,2) not null check (subtotal >= 0),
  component_count integer not null default 0 check (component_count >= 0),
  component_checks jsonb not null default '[]'::jsonb,
  hold_summary jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trip_package_checkout_attempts_quote_idx on public.trip_package_checkout_attempts(quote_id, created_at desc);
create index if not exists trip_package_checkout_attempts_trip_idx on public.trip_package_checkout_attempts(trip_id, created_at desc);
alter table public.trip_package_checkout_attempts enable row level security;
drop policy if exists "travelers read own package checkout attempts" on public.trip_package_checkout_attempts;
create policy "travelers read own package checkout attempts" on public.trip_package_checkout_attempts for select to authenticated using (traveler_id = auth.uid() and exists (select 1 from public.trips t where t.id=trip_id and t.traveler_id=auth.uid()));
comment on table public.trip_package_checkout_attempts is 'Checkout-readiness audit snapshots. A ready row means recorded components passed SafariPlug checks; it does not mean payment, supplier hold, or confirmed booking.';
