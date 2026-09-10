-- Reserve a payment idempotency key before calling an external provider.
-- The lease lets a crashed request be retried without permanently blocking the key.
alter table public.service_payment_idempotency
  add column if not exists processing_until timestamptz;

create index if not exists service_payment_idempotency_processing_idx
  on public.service_payment_idempotency (processing_until)
  where payment_intent_id is null;
