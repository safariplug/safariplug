create or replace function public.reschedule_service_appointment(
  p_appointment_id uuid,
  p_customer_user_id uuid,
  p_starts_at timestamptz,
  p_note text default null
) returns public.service_appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.service_appointments;
  v_offering public.service_offerings;
  v_profile public.service_profiles;
  v_business public.businesses;
  v_ends_at timestamptz;
begin
  select * into v_appointment
  from public.service_appointments
  where id = p_appointment_id
    and customer_user_id = p_customer_user_id
  for update;

  if not found then raise exception 'appointment_not_found'; end if;
  if v_appointment.status not in ('pending','confirmed') then raise exception 'appointment_not_reschedulable'; end if;

  select * into v_profile
  from public.service_profiles
  where id = v_appointment.service_profile_id;
  if not found or v_profile.status <> 'active' or v_profile.booking_status <> 'open' then raise exception 'service_not_bookable'; end if;

  select * into v_business from public.businesses where id = v_profile.business_id;
  if not found or v_business.status <> 'active' then raise exception 'service_not_bookable'; end if;

  select * into v_offering
  from public.service_offerings
  where id = v_appointment.offering_id
    and service_profile_id = v_appointment.service_profile_id
    and status = 'active';
  if not found then raise exception 'service_not_bookable'; end if;

  if p_starts_at is null then raise exception 'invalid_appointment_time'; end if;
  v_ends_at := p_starts_at + make_interval(mins => v_offering.duration_minutes);

  update public.service_appointments
  set starts_at = p_starts_at,
      ends_at = v_ends_at,
      updated_at = now()
  where id = v_appointment.id
  returning * into v_appointment;

  insert into public.service_appointment_status_events(
    appointment_id, from_status, to_status, actor_type, actor_user_id, note
  ) values (
    v_appointment.id,
    v_appointment.status,
    v_appointment.status,
    'customer',
    p_customer_user_id,
    coalesce(nullif(p_note,''), 'Appointment rescheduled')
  );

  return v_appointment;
end;
$$;

revoke all on function public.reschedule_service_appointment(uuid,uuid,timestamptz,text) from public, anon, authenticated;
grant execute on function public.reschedule_service_appointment(uuid,uuid,timestamptz,text) to service_role;
