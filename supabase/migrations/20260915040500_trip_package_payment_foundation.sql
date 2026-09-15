create table if not exists public.trip_package_payment_intents (
 id uuid primary key default gen_random_uuid(),
 checkout_attempt_id uuid not null references public.trip_package_checkout_attempts(id) on delete cascade,
 quote_id uuid not null references public.trip_package_quotes(id) on delete cascade,
 trip_id uuid not null references public.trips(id) on delete cascade,
 traveler_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check (provider in ('stripe','mpesa')),
 idempotency_key text not null,
 currency text not null,
 amount numeric(14,2) not null check (amount > 0),
 status text not null default 'created' check (status in ('created','provider_not_configured','requires_action','processing','succeeded','failed','cancelled')),
 provider_reference text,
 provider_payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(traveler_id,idempotency_key)
);
create index if not exists trip_package_payment_intents_trip_idx on public.trip_package_payment_intents(trip_id,created_at desc);
alter table public.trip_package_payment_intents enable row level security;
drop policy if exists "travelers read own package payment intents" on public.trip_package_payment_intents;
create policy "travelers read own package payment intents" on public.trip_package_payment_intents for select to authenticated using (traveler_id=auth.uid() and exists(select 1 from public.trips t where t.id=trip_id and t.traveler_id=auth.uid()));
comment on table public.trip_package_payment_intents is 'Package payment orchestration records. Creating an intent does not mean money was charged or any trip component was confirmed.';
