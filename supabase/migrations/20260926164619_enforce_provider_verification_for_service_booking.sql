create or replace function public.service_provider_verification_ready(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1
    from public.verification_cases vc
    where vc.subject_type = 'provider'
      and vc.subject_id = p_user_id
      and vc.status = 'approved'
      and (vc.expires_at is null or vc.expires_at > now())
      and (
        vc.provider = 'human_review'
        or (
          vc.verification_level in ('identity','enhanced')
          and exists (
            select 1
            from public.verification_evidence ve
            where ve.case_id = vc.id
              and ve.evidence_type = 'identity'
              and ve.status = 'accepted'
              and (ve.expires_at is null or ve.expires_at > now())
          )
          and exists (
            select 1
            from public.verification_evidence ve
            where ve.case_id = vc.id
              and ve.evidence_type = 'liveness'
              and ve.status = 'accepted'
              and (ve.expires_at is null or ve.expires_at > now())
          )
        )
      )
  );
$$;

create or replace function public.guard_service_appointment_provider_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider_user_id uuid;
begin
  select b.owner_id
    into v_provider_user_id
  from public.service_profiles sp
  join public.businesses b on b.id = sp.business_id
  where sp.id = new.service_profile_id;

  if v_provider_user_id is null then
    raise exception 'service_provider_not_found';
  end if;

  if not public.service_provider_verification_ready(v_provider_user_id) then
    raise exception 'provider_verification_not_current';
  end if;

  return new;
end;
$$;

drop trigger if exists service_appointments_provider_verification_guard on public.service_appointments;
create trigger service_appointments_provider_verification_guard
before insert or update of starts_at,service_profile_id on public.service_appointments
for each row execute function public.guard_service_appointment_provider_verification();

revoke all on function public.service_provider_verification_ready(uuid) from public, anon, authenticated;
grant execute on function public.service_provider_verification_ready(uuid) to service_role;

revoke all on function public.guard_service_appointment_provider_verification() from public, anon, authenticated;
grant execute on function public.guard_service_appointment_provider_verification() to service_role;
