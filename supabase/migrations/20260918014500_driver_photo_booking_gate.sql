-- Extend driver booking eligibility with the public personal-photo requirement.
-- The public photo is a recognition aid only; identity/liveness verification remains separate.

drop policy if exists "public reads eligible active transfer rates" on public.driver_transfer_rates;
create policy "public reads eligible active transfer rates"
on public.driver_transfer_rates
for select
using (
  status='active'
  and exists (
    select 1
    from public.driver_profiles d
    where d.id=driver_id
      and d.service_status='active'
      and d.verification_state='verified'
      and d.personal_photo_url is not null
      and d.driving_license_compliance_status in ('valid','expiring_soon')
  )
);

drop policy if exists "travelers create eligible transfer requests" on public.driver_transfer_requests;
create policy "travelers create eligible transfer requests"
on public.driver_transfer_requests
for insert
to authenticated
with check (
  traveler_id=auth.uid()
  and requested_at > now()
  and exists (
    select 1
    from public.driver_profiles d
    where d.id=driver_id
      and d.service_status='active'
      and d.verification_state='verified'
      and d.personal_photo_url is not null
      and d.driving_license_compliance_status in ('valid','expiring_soon')
  )
  and (
    trip_id is null
    or exists (
      select 1 from public.trips t
      where t.id=trip_id and t.traveler_id=auth.uid()
    )
  )
);

create or replace function public.respond_to_driver_transfer_request(
  p_request_id uuid,
  p_decision text
)
returns public.driver_transfer_requests
language plpgsql
security definer
set search_path=public
as $$
declare
  v_driver public.driver_profiles;
  v_request public.driver_transfer_requests;
  v_conflict boolean;
begin
  if p_decision not in ('accepted','declined') then
    raise exception 'invalid_decision';
  end if;

  select *
  into v_driver
  from public.driver_profiles
  where user_id=auth.uid();

  if v_driver.id is null then
    raise exception 'driver_profile_required';
  end if;

  select *
  into v_request
  from public.driver_transfer_requests
  where id=p_request_id and driver_id=v_driver.id
  for update;

  if v_request.id is null then
    raise exception 'request_not_found';
  end if;
  if v_request.status<>'requested' then
    raise exception 'request_already_resolved';
  end if;

  if p_decision='accepted' then
    if v_driver.service_status<>'active'
      or v_driver.verification_state<>'verified'
      or v_driver.personal_photo_url is null
      or v_driver.driving_license_compliance_status not in ('valid','expiring_soon')
    then
      raise exception 'driver_not_eligible';
    end if;

    select exists(
      select 1
      from public.driver_availability a
      where a.driver_id=v_driver.id
        and a.available_on=v_request.requested_at::date
        and a.status='unavailable'
        and (a.start_time is null or a.start_time<=v_request.requested_at::time)
        and (a.end_time is null or a.end_time>v_request.requested_at::time)
    )
    into v_conflict;

    if v_conflict then
      raise exception 'driver_unavailable';
    end if;
  end if;

  update public.driver_transfer_requests
  set status=p_decision,updated_at=now()
  where id=v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.respond_to_driver_transfer_request(uuid,text) from public;
grant execute on function public.respond_to_driver_transfer_request(uuid,text) to authenticated;
