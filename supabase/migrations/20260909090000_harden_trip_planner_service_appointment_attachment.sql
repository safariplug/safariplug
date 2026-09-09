create or replace function public.attach_service_appointment_to_trip(
  p_appointment_id uuid,
  p_trip_id uuid,
  p_traveler_id uuid
) returns public.trip_items
language plpgsql
security definer
set search_path = ''
as $$
declare v_appointment public.service_appointments; v_trip public.trips; v_item public.trip_items; v_position integer;
begin
  select * into v_trip from public.trips where id=p_trip_id and traveler_id=p_traveler_id for update;
  if not found then raise exception 'trip_not_found'; end if;
  select * into v_appointment from public.service_appointments where id=p_appointment_id and customer_user_id=p_traveler_id for update;
  if not found then raise exception 'appointment_not_found'; end if;
  if v_appointment.trip_id is not null and v_appointment.trip_id <> p_trip_id then raise exception 'appointment_already_in_trip'; end if;
  select * into v_item from public.trip_items where appointment_id=p_appointment_id for update;
  if found and v_item.trip_id <> p_trip_id then raise exception 'appointment_already_in_trip'; end if;
  if found then return v_item; end if;
  select coalesce(max(position),-1)+1 into v_position from public.trip_items where trip_id=p_trip_id;
  insert into public.trip_items (trip_id,appointment_id,item_kind,title,start_at,end_at,position,notes)
  values (p_trip_id,p_appointment_id,'service',v_appointment.customer_name,v_appointment.starts_at,v_appointment.ends_at,v_position,v_appointment.customer_notes)
  returning * into v_item;
  update public.service_appointments set trip_id=p_trip_id,updated_at=now() where id=p_appointment_id;
  return v_item;
end;
$$;
revoke all on function public.attach_service_appointment_to_trip(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.attach_service_appointment_to_trip(uuid,uuid,uuid) to service_role;

create or replace function public.detach_service_appointment_from_trip(p_item_id uuid,p_trip_id uuid,p_traveler_id uuid)
returns public.trip_items language plpgsql security definer set search_path = '' as $$
declare v_item public.trip_items; v_appointment public.service_appointments; v_trip public.trips;
begin
 select * into v_trip from public.trips where id=p_trip_id and traveler_id=p_traveler_id for update;
 if not found then raise exception 'trip_not_found'; end if;
 select * into v_item from public.trip_items where id=p_item_id and trip_id=p_trip_id and appointment_id is not null for update;
 if not found then raise exception 'trip_item_not_found'; end if;
 select * into v_appointment from public.service_appointments where id=v_item.appointment_id and customer_user_id=p_traveler_id and trip_id=p_trip_id for update;
 if not found then raise exception 'appointment_not_found'; end if;
 delete from public.trip_items where id=v_item.id;
 update public.service_appointments set trip_id=null,updated_at=now() where id=v_appointment.id;
 return v_item;
end;
$$;
revoke all on function public.detach_service_appointment_from_trip(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.detach_service_appointment_from_trip(uuid,uuid,uuid) to service_role;
