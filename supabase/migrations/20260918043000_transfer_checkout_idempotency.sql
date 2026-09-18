alter table public.transfer_booking_pricing_ledger
  add column if not exists checkout_intent_key text,
  add column if not exists payment_initiation_started_at timestamptz;

create unique index if not exists transfer_booking_pricing_ledger_checkout_intent_idx
  on public.transfer_booking_pricing_ledger(customer_user_id, provider, checkout_intent_key)
  where checkout_intent_key is not null;

comment on column public.transfer_booking_pricing_ledger.checkout_intent_key is
  'Client checkout-session idempotency key. Prevents duplicate transfer ledger/payment preparation for the same explicit checkout attempt.';

comment on column public.transfer_booking_pricing_ledger.payment_initiation_started_at is
  'Set before submitting an external payment request. A non-null value prevents concurrent duplicate M-Pesa initiation for the same checkout intent.';
