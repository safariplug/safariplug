alter table public.activity_booking_pricing_ledger
  add column if not exists checkout_intent_key text,
  add column if not exists preconfirm_initiation_started_at timestamptz,
  add column if not exists payment_initiation_started_at timestamptz;

create unique index if not exists activity_booking_pricing_ledger_checkout_intent_idx
  on public.activity_booking_pricing_ledger(customer_user_id, provider, checkout_intent_key)
  where checkout_intent_key is not null;

comment on column public.activity_booking_pricing_ledger.checkout_intent_key is
  'Client checkout-session idempotency key for one explicit activity checkout attempt.';
comment on column public.activity_booking_pricing_ledger.preconfirm_initiation_started_at is
  'Set before Hotelbeds PRECONFIRM to prevent concurrent duplicate supplier holds.';
comment on column public.activity_booking_pricing_ledger.payment_initiation_started_at is
  'Set before M-Pesa initiation to prevent concurrent duplicate STK pushes.';
