-- Prevent multiple simultaneous external payment submissions for one
-- service appointment/provider even when clients send different idempotency keys.

alter table public.service_payment_idempotency
  add column if not exists attempt_active boolean not null default false;

-- Reconstruct active state conservatively for any existing rows.
update public.service_payment_idempotency i
set attempt_active = true
from public.service_appointments a
where a.id = i.appointment_id
  and (
    i.provider_submission_state in ('submitted','uncertain')
    or (
      i.payment_intent_id is not null
      and a.payment_status in ('unpaid','pending','paid','partially_refunded','refunded','disputed')
    )
  );

create unique index if not exists service_payment_idempotency_one_active_attempt_idx
  on public.service_payment_idempotency (appointment_id, provider)
  where attempt_active = true;

create index if not exists service_payment_idempotency_active_lookup_idx
  on public.service_payment_idempotency (appointment_id, customer_user_id, provider)
  where attempt_active = true;

comment on column public.service_payment_idempotency.attempt_active is
  'True while this row owns the only active external payment attempt for the appointment/provider. Cleared after a confirmed failed/cancelled provider result so a governed retry can start.';
