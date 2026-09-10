alter table public.food_order_payment_idempotency
  add column if not exists processing_until timestamptz;

create index if not exists food_order_payment_idempotency_processing_idx
  on public.food_order_payment_idempotency(processing_until)
  where payment_intent_id is null;
