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
