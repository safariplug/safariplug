-- Harden the specific-driver request state machine so backend enforcement
-- matches the traveler and driver portals.
--
-- Rules:
--   * a driver cannot accept a request without a positive quote
--   * a driver cannot accept a pickup that has already passed
--   * a ride cannot be marked completed until SafariPlug has recorded payment
--   * only the assigned driver account can mutate the request

create or replace function public.respond_to_driver_transfer_request(
  p_request_id uuid,
  p_decision text
)
returns public.driver_transfer_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.driver_profiles;
  v_request public.driver_transfer_requests;
  v_conflict boolean;
  v_verified boolean;
  v_vehicle_ok boolean;
begin
  if p_decision not in ('accepted','declined') then
    raise exception 'invalid_decision';
  end if;

  select *
  into v_driver
  from public.driver_profiles
  where user_id = auth.uid();

  if v_driver.id is null then
    raise exception 'driver_profile_required';
  end if;

  select *
  into v_request
  from public.driver_transfer_requests
  where id = p_request_id
    and driver_id = v_driver.id
  for update;

  if v_request.id is null then
    raise exception 'request_not_found';
  end if;

  if v_request.status <> 'requested' then
    raise exception 'request_already_resolved';
  end if;

  if p_decision = 'accepted' then
    if v_request.quoted_amount is null or v_request.quoted_amount <= 0 then
      raise exception 'transfer_quote_required';
    end if;

    if v_request.requested_at <= now() then
      raise exception 'pickup_time_passed';
    end if;

    if v_driver.service_status <> 'active'
      or v_driver.verification_state <> 'verified'
      or v_driver.driving_license_compliance_status not in ('valid','expiring_soon') then
      raise exception 'driver_not_eligible';
    end if;

    select exists (
      select 1
      from public.verification_cases vc
      where vc.subject_type = 'driver'
        and vc.subject_id = v_driver.id
        and vc.status = 'approved'
        and (vc.expires_at is null or vc.expires_at > now())
        and (
          vc.provider = 'human_review'
          or v_driver.identity_liveness_verified_at is not null
        )
    )
    into v_verified;

    if not v_verified then
      raise exception 'driver_verification_not_current';
    end if;

    select exists (
      select 1
      from public.vehicles v
      where v.driver_id = v_driver.id
        and v.status = 'active'
        and v.registration_compliance_status in ('valid','expiring_soon')
        and v.insurance_compliance_status in ('valid','expiring_soon')
        and (
          v.passenger_capacity is null
          or v.passenger_capacity >= v_request.passenger_count
        )
    )
    into v_vehicle_ok;

    if not v_vehicle_ok then
      raise exception 'driver_vehicle_not_eligible';
    end if;

    select exists (
      select 1
      from public.driver_availability a
      where a.driver_id = v_driver.id
        and a.available_on = v_request.requested_at::date
        and a.status = 'unavailable'
        and (a.start_time is null or a.start_time <= v_request.requested_at::time)
        and (a.end_time is null or a.end_time > v_request.requested_at::time)
    )
    into v_conflict;

    if v_conflict then
      raise exception 'driver_unavailable';
    end if;
  end if;

  update public.driver_transfer_requests
  set status = p_decision,
      updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.respond_to_driver_transfer_request(uuid,text) from public;
grant execute on function public.respond_to_driver_transfer_request(uuid,text) to authenticated;
grant execute on function public.respond_to_driver_transfer_request(uuid,text) to service_role;

create or replace function public.complete_driver_transfer_request(
  p_request_id uuid
)
returns public.driver_transfer_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.driver_profiles;
  v_request public.driver_transfer_requests;
begin
  select *
  into v_driver
  from public.driver_profiles
  where user_id = auth.uid();

  if v_driver.id is null then
    raise exception 'driver_profile_required';
  end if;

  select *
  into v_request
  from public.driver_transfer_requests
  where id = p_request_id
    and driver_id = v_driver.id
  for update;

  if v_request.id is null then
    raise exception 'request_not_found';
  end if;

  if v_request.status <> 'accepted' then
    raise exception 'request_not_completable';
  end if;

  if coalesce(v_request.payment_status, 'unpaid') <> 'paid'
    or v_request.paid_at is null then
    raise exception 'transfer_payment_required';
  end if;

  if v_request.requested_at > now() then
    raise exception 'ride_not_started';
  end if;

  update public.driver_transfer_requests
  set status = 'completed',
      updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.complete_driver_transfer_request(uuid) from public;
grant execute on function public.complete_driver_transfer_request(uuid) to authenticated;
grant execute on function public.complete_driver_transfer_request(uuid) to service_role;
