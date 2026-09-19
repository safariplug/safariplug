-- Enforce mandatory traveler identity/liveness verification at the database
-- boundary for all service appointments, regardless of which server route creates them.

create or replace function public.service_appointment_require_verified_traveler()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.customer_user_id is null then
    raise exception 'traveler_verification_required';
  end if;

  if not exists (
    select 1
    from public.verification_cases vc
    where vc.subject_type = 'traveler'
      and vc.subject_id = new.customer_user_id
      and vc.status = 'approved'
      and (vc.expires_at is null or vc.expires_at > now())
  ) then
    raise exception 'traveler_verification_required';
  end if;

  return new;
end;
$$;

revoke execute on function public.service_appointment_require_verified_traveler()
from public, anon, authenticated;
grant execute on function public.service_appointment_require_verified_traveler()
to service_role;

drop trigger if exists service_appointment_require_verified_traveler
  on public.service_appointments;

create trigger service_appointment_require_verified_traveler
before insert or update of customer_user_id
on public.service_appointments
for each row execute function public.service_appointment_require_verified_traveler();

comment on function public.service_appointment_require_verified_traveler() is
  'Trigger-only guard requiring an approved, unexpired traveler verification before a service appointment can be linked to a customer account.';
