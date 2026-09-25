create or replace function public.driver_require_approved_verification()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.verification_state = 'verified' then
    if exists (
      select 1
      from public.verification_cases c
      where c.subject_type = 'driver'
        and c.subject_id = new.id
        and c.status = 'approved'
        and c.provider = 'human_review'
        and (c.expires_at is null or c.expires_at > now())
    ) then
      return new;
    end if;

    if new.identity_liveness_verified_at is null then
      raise exception 'Driver verification_state=verified requires identity_liveness_verified_at or approved SafariPlug staff review';
    end if;

    if not exists (
      select 1
      from public.verification_cases c
      where c.subject_type = 'driver'
        and c.subject_id = new.id
        and c.status = 'approved'
        and c.provider = 'sumsub'
        and (c.expires_at is null or c.expires_at > now())
        and exists (
          select 1
          from public.verification_evidence e
          where e.case_id = c.id
            and e.evidence_type = 'identity'
            and e.status = 'accepted'
            and e.provider = 'sumsub'
        )
        and exists (
          select 1
          from public.verification_evidence e
          where e.case_id = c.id
            and e.evidence_type = 'liveness'
            and e.status = 'accepted'
            and e.provider = 'sumsub'
        )
    ) then
      raise exception 'Driver verification_state=verified requires approved external identity and liveness evidence or approved SafariPlug staff review';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.driver_require_activation_compliance()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.service_status = 'active' then
    if new.verification_state <> 'verified' then
      raise exception 'Driver cannot become active before verification is approved';
    end if;
    if new.driving_license_compliance_status not in ('valid','expiring_soon') then
      raise exception 'Driver cannot become active before license compliance is current';
    end if;
    if not exists (
      select 1
      from public.vehicles v
      where v.driver_id = new.id
        and v.status = 'active'
        and v.registration_compliance_status in ('valid','expiring_soon')
        and v.insurance_compliance_status in ('valid','expiring_soon')
    ) then
      raise exception 'Driver cannot become active without an active vehicle with current registration and insurance';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.driver_require_vehicle_compliance_for_active()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  driver_id_value uuid := coalesce(new.driver_id, old.driver_id);
  driver_status text;
  new_vehicle_eligible boolean := false;
begin
  select dp.service_status into driver_status
  from public.driver_profiles dp
  where dp.id = driver_id_value;

  if driver_status <> 'active' then
    return coalesce(new, old);
  end if;

  if tg_op <> 'DELETE' then
    new_vehicle_eligible := new.status = 'active'
      and new.registration_compliance_status in ('valid','expiring_soon')
      and new.insurance_compliance_status in ('valid','expiring_soon');
  end if;

  if not exists (
    select 1
    from public.vehicles v
    where v.driver_id = driver_id_value
      and v.id <> coalesce(new.id, old.id)
      and v.status = 'active'
      and v.registration_compliance_status in ('valid','expiring_soon')
      and v.insurance_compliance_status in ('valid','expiring_soon')
  ) and not new_vehicle_eligible then
    raise exception 'Active driver must retain at least one active vehicle with current registration and insurance';
  end if;
  return coalesce(new, old);
end;
$function$;

alter policy "travelers create eligible transfer requests"
on public.driver_transfer_requests
with check (
  traveler_id = (select auth.uid())
  and requested_at > now()
  and exists (
    select 1
    from public.verification_cases vc
    where vc.subject_type = 'traveler'
      and vc.subject_id = (select auth.uid())
      and vc.status = 'approved'
      and (vc.expires_at is null or vc.expires_at > now())
  )
  and exists (
    select 1
    from public.driver_profiles d
    where d.id = driver_transfer_requests.driver_id
      and d.service_status = 'active'
      and d.verification_state = 'verified'
      and (
        d.identity_liveness_verified_at is not null
        or exists (
          select 1
          from public.verification_cases dvc
          where dvc.subject_type = 'driver'
            and dvc.subject_id = d.id
            and dvc.status = 'approved'
            and dvc.provider = 'human_review'
            and (dvc.expires_at is null or dvc.expires_at > now())
        )
      )
      and d.personal_photo_url is not null
      and d.driving_license_compliance_status in ('valid','expiring_soon')
  )
  and (
    trip_id is null
    or exists (
      select 1
      from public.trips t
      where t.id = driver_transfer_requests.trip_id
        and t.traveler_id = (select auth.uid())
    )
  )
);