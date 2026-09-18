alter table public.hotel_booking_pricing_ledger
  add column if not exists checkout_intent_key text,
  add column if not exists payment_initiation_started_at timestamptz;

create unique index if not exists hotel_booking_pricing_ledger_checkout_intent_idx
  on public.hotel_booking_pricing_ledger(customer_user_id, provider, checkout_intent_key)
  where checkout_intent_key is not null;

create table if not exists public.hotel_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  intent_key text not null,
  state text not null default 'initialized'
    check (state in (
      'initialized',
      'supplier_preparing',
      'supplier_prepared',
      'payment_initializing',
      'payment_pending',
      'payment_indeterminate',
      'supplier_prepare_indeterminate',
      'failed',
      'confirmed'
    )),
  prepared_booking_id text,
  ledger_id uuid references public.hotel_booking_pricing_ledger(id) on delete set null,
  supplier_prepare_started_at timestamptz,
  payment_initiation_started_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(customer_user_id, provider, intent_key)
);

create index if not exists hotel_checkout_intents_customer_idx
  on public.hotel_checkout_intents(customer_user_id, created_at desc);

alter table public.hotel_checkout_intents enable row level security;
revoke all on table public.hotel_checkout_intents from anon, authenticated;

comment on table public.hotel_checkout_intents is
  'Server-only hotel checkout idempotency coordinator. Prevents duplicate supplier preparation and M-Pesa initiation across repeated or concurrent checkout requests.';

comment on column public.hotel_booking_pricing_ledger.checkout_intent_key is
  'Stable client checkout key used to reuse one governed hotel checkout attempt.';
comment on column public.hotel_booking_pricing_ledger.payment_initiation_started_at is
  'Set before outbound M-Pesa submission to prevent concurrent duplicate STK pushes.';
