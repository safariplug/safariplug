-- Keep the service-appointment-to-trip mutation server-only.
-- The function performs an atomic insert/update and must not be callable by client roles.
create or replace function public.attach_service_appointment_to_trip(p_appointment_id uuid, p_trip_id uuid, p_traveler_id uuid)
returns public.trip_items
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.service_appointments;
  trip public.trips;
  existing public.trip_items;
  item public.trip_items;
begin
  if auth.uid() is null or auth.uid() is distinct from p_traveler_id then
    raise exception 'unauthorized';
  end if;

  select * into appt from public.service_appointments where id = p_appointment_id;
  if not found or appt.customer_user_id is distinct from p_traveler_id then
    raise exception 'appointment_not_found';
  end if;

  select * into trip from public.trips where id = p_trip_id and traveler_id = p_traveler_id;
  if not found then raise exception 'trip_not_found'; end if;

  select * into existing from public.trip_items where service_appointment_id = p_appointment_id limit 1;
  if found then
    if existing.trip_id = p_trip_id then return existing; end if;
    raise exception 'appointment_already_in_trip';
  end if;

  insert into public.trip_items (trip_id, service_appointment_id, item_kind, position, start_at, end_at, title, notes)
  values (
    p_trip_id,
    p_appointment_id,
    'personal_service',
    coalesce((select max(position) + 1 from public.trip_items where trip_id = p_trip_id), 0),
    appt.starts_at,
    appt.ends_at,
    'Service appointment',
    appt.customer_notes
  )
  returning * into item;

  update public.service_appointments set trip_id = p_trip_id, updated_at = now() where id = p_appointment_id;
  update public.trips set updated_at = now() where id = p_trip_id;
  return item;
end;
$$;

revoke all on function public.attach_service_appointment_to_trip(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.attach_service_appointment_to_trip(uuid, uuid, uuid) to service_role;
