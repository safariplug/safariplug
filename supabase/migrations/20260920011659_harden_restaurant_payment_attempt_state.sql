alter table public.food_order_payment_idempotency
  add column if not exists provider_submission_state text not null default 'ready',
  add column if not exists attempt_active boolean not null default false;

alter table public.food_order_payment_idempotency
  drop constraint if exists food_order_payment_idempotency_submission_state_check;

alter table public.food_order_payment_idempotency
  add constraint food_order_payment_idempotency_submission_state_check
  check (provider_submission_state in ('ready','submitted','uncertain'));

create unique index if not exists food_order_payment_one_active_attempt
on public.food_order_payment_idempotency (order_id, provider)
where attempt_active is true;
