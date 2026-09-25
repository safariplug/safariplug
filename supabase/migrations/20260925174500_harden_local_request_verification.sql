alter policy "travelers create own local requests"
on public.local_requests
with check (
  auth.uid() = traveler_id
  and exists (
    select 1
    from public.verification_cases vc
    where vc.subject_type = 'traveler'
      and vc.subject_id = auth.uid()
      and vc.status = 'approved'
      and (vc.expires_at is null or vc.expires_at > now())
  )
  and exists (
    select 1
    from public.local_profiles p
    where p.id = local_requests.local_id
      and p.service_status = 'active'
      and p.verification_state = 'verified'
      and p.identity_liveness_verified_at is not null
      and exists (
        select 1
        from public.verification_cases lvc
        where lvc.subject_type = 'local'
          and lvc.subject_id = p.id
          and lvc.status = 'approved'
          and (lvc.expires_at is null or lvc.expires_at > now())
      )
  )
  and (
    trip_id is null
    or exists (
      select 1
      from public.trips t
      where t.id = local_requests.trip_id
        and t.traveler_id = auth.uid()
    )
  )
);

create or replace function public.respond_to_local_request(
  p_request_id uuid,
  p_decision text
)
returns public.local_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local public.local_profiles;
  v_request public.local_requests;
  v_current_verification boolean;
begin
  if p_decision not in ('accepted','declined') then
    raise exception 'invalid_decision';
  end if;

  select *
  into v_local
  from public.local_profiles
  where user_id = auth.uid();

  if v_local.id is null then
    raise exception 'local_profile_required';
  end if;

  select *
  into v_request
  from public.local_requests
  where id = p_request_id
    and local_id = v_local.id
  for update;

  if v_request.id is null then
    raise exception 'request_not_found';
  end if;

  if v_request.status <> 'requested' then
    raise exception 'request_already_resolved';
  end if;

  if p_decision = 'accepted' then
    if v_local.service_status <> 'active'
      or v_local.verification_state <> 'verified'
      or v_local.identity_liveness_verified_at is null then
      raise exception 'local_not_eligible';
    end if;

    select exists (
      select 1
      from public.verification_cases vc
      where vc.subject_type = 'local'
        and vc.subject_id = v_local.id
        and vc.status = 'approved'
        and (vc.expires_at is null or vc.expires_at > now())
    )
    into v_current_verification;

    if not v_current_verification then
      raise exception 'local_verification_not_current';
    end if;

    if v_request.requested_start_at <= now() then
      raise exception 'request_time_passed';
    end if;
  end if;

  update public.local_requests
  set status = p_decision,
      updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.respond_to_local_request(uuid,text) from public;
grant execute on function public.respond_to_local_request(uuid,text) to authenticated;
grant execute on function public.respond_to_local_request(uuid,text) to service_role;
