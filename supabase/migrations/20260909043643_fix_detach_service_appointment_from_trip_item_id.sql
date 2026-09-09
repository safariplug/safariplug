create or replace function public.detach_service_appointment_from_trip(
  p_item_id uuid,
  p_trip_id uuid,
  p_traveler_id uuid
) returns public.trip_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.trip_items;
  v_appointment public.service_appointments;
begin
  select * into v_item
  from public.trip_items
  where id = p_item_id
    and trip_id = p_trip_id
    and appointment_id is not null
  for update;
  if not found then raise exception 'trip_item_not_found'; end if;
  select * into v_appointment
  from public.service_appointments
  where id = v_item.appointment_id
    and customer_user_id = p_traveler_id
    and trip_id = p_trip_id
  for update;
  if not found then raise exception 'appointment_not_found'; end if;
  delete from public.trip_items where id = v_item.id;
  update public.service_appointments set trip_id = null, updated_at = now() where id = v_appointment.id;
  return v_item;
end;
$$;
revoke all on function public.detach_service_appointment_from_trip(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.detach_service_appointment_from_trip(uuid,uuid,uuid) to service_role;
