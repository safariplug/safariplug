-- Hotel booking pricing ledger.
-- Keeps the customer-facing retail amount separate from the supplier net amount.
-- Payment must not be marked paid until the provider settlement/confirmation path succeeds.

create table if not exists public.hotel_booking_pricing_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  quote_id text,
  prepared_booking_id text,
  provider_booking_reference text,
  currency text not null,
  supplier_net_amount numeric(12,2) not null check (supplier_net_amount >= 0),
  retail_amount numeric(12,2) not null check (retail_amount >= 0),
  markup_percent numeric(6,3) not null default 10 check (markup_percent >= 0),
  payment_provider text,
  payment_reference text,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','failed','refunded','cancelled')),
  booking_status text not null default 'pending' check (booking_status in ('pending','prepared','payment_pending','confirmed','failed','cancelled')),
  supplier_settlement_status text not null default 'not_started' check (supplier_settlement_status in ('not_started','pending','settled','failed')),
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_booking_pricing_ledger_amounts check (retail_amount >= supplier_net_amount)
);

create unique index if not exists hotel_booking_pricing_ledger_payment_ref_idx
  on public.hotel_booking_pricing_ledger(payment_provider, payment_reference)
  where payment_reference is not null;

create index if not exists hotel_booking_pricing_ledger_customer_idx
  on public.hotel_booking_pricing_ledger(customer_user_id, created_at desc);

create index if not exists hotel_booking_pricing_ledger_provider_idx
  on public.hotel_booking_pricing_ledger(provider, booking_status, supplier_settlement_status);

alter table public.hotel_booking_pricing_ledger enable row level security;

drop policy if exists "customers can view their hotel pricing ledger" on public.hotel_booking_pricing_ledger;
create policy "customers can view their hotel pricing ledger"
  on public.hotel_booking_pricing_ledger
  for select
  to authenticated
  using ((select auth.uid()) = customer_user_id);

create or replace function public.set_hotel_booking_pricing_ledger_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hotel_booking_pricing_ledger_updated_at on public.hotel_booking_pricing_ledger;
create trigger hotel_booking_pricing_ledger_updated_at
before update on public.hotel_booking_pricing_ledger
for each row execute function public.set_hotel_booking_pricing_ledger_updated_at();
