-- Prevent automatic retries from issuing a second external payment when a
-- provider request may have been accepted but its response was lost.
alter table public.service_payment_idempotency
  add column if not exists provider_submission_state text not null default 'ready';

alter table public.service_payment_idempotency
  drop constraint if exists service_payment_idempotency_provider_submission_state_check;

alter table public.service_payment_idempotency
  add constraint service_payment_idempotency_provider_submission_state_check
  check (provider_submission_state in ('ready','submitted','uncertain'));

create index if not exists service_payment_idempotency_submission_state_idx
  on public.service_payment_idempotency (provider_submission_state)
  where payment_intent_id is null;
