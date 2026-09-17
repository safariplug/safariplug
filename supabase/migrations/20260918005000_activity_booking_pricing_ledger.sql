-- Governed Hotelbeds Activities checkout ledger.
-- Activities use Hotelbeds PRECONFIRM to hold stock while the traveler pays.
-- RECONFIRM is allowed only after successful payment.
-- Ambiguous reconfirmation is never blindly retried.

create table if not exists public.activity_booking_pricing_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'hotelbeds',
  prepared_booking_id text not null,
  provider_booking_reference text,
  supplier_currency text not null,
  customer_currency text not null,
  exchange_rate numeric(20,10),
  supplier_amount numeric(14,2) not null check (supplier_amount >= 0),
  retail_amount numeric(14,2) not null check (retail_amount >= 0),
  markup_percent numeric(6,3) not null default 10 check (markup_percent >= 0),
  payment_provider text,
  payment_reference text,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','pending','paid','failed','refunded','cancelled')),
  booking_status text not null default 'preconfirm_pending'
    check (booking_status in ('preconfirm_pending','preconfirmed','payment_pending','confirmed','failed','cancelled')),
  supplier_settlement_status text not null default 'pending'
    check (supplier_settlement_status in ('pending','settled','failed')),
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  preconfirmed_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists activity_booking_pricing_ledger_prepared_idx
  on public.activity_booking_pricing_ledger(prepared_booking_id);

create unique index if not exists activity_booking_pricing_ledger_payment_ref_idx
  on public.activity_booking_pricing_ledger(payment_provider, payment_reference)
  where payment_reference is not null;

create index if not exists activity_booking_pricing_ledger_customer_idx
  on public.activity_booking_pricing_ledger(customer_user_id, created_at desc);

create index if not exists activity_booking_pricing_ledger_provider_idx
  on public.activity_booking_pricing_ledger(provider, booking_status, supplier_settlement_status);

alter table public.activity_booking_pricing_ledger enable row level security;

drop policy if exists activity_booking_pricing_ledger_customer_select
  on public.activity_booking_pricing_ledger;
create policy activity_booking_pricing_ledger_customer_select
  on public.activity_booking_pricing_ledger
  for select
  to authenticated
  using (customer_user_id = (select auth.uid()));

create or replace function public.set_activity_booking_pricing_ledger_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists activity_booking_pricing_ledger_updated_at
  on public.activity_booking_pricing_ledger;
create trigger activity_booking_pricing_ledger_updated_at
before update on public.activity_booking_pricing_ledger
for each row execute function public.set_activity_booking_pricing_ledger_updated_at();
