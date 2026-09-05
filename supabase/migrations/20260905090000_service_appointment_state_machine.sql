create or replace function public.transition_service_appointment_status(
  p_appointment_id uuid,
  p_to_status text,
  p_actor_type text,
  p_actor_user_id uuid default null,
  p_note text default null
) returns public.service_appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.service_appointments;
  v_from_status text;
  v_allowed boolean := false;
begin
  if p_actor_type not in ('customer','provider','admin','system') then
    raise exception 'invalid_actor_type';
  end if;

  select * into v_appointment
  from public.service_appointments
  where id = p_appointment_id
  for update;

  if not found then raise exception 'appointment_not_found'; end if;
  v_from_status := v_appointment.status;

  if p_to_status not in ('pending','confirmed','checked_in','in_progress','completed','cancelled','no_show') then
    raise exception 'invalid_appointment_status';
  end if;

  v_allowed := case
    when v_from_status = 'pending' then p_to_status in ('confirmed','cancelled')
    when v_from_status = 'confirmed' then p_to_status in ('checked_in','cancelled','no_show')
    when v_from_status = 'checked_in' then p_to_status in ('in_progress','cancelled','no_show')
    when v_from_status = 'in_progress' then p_to_status in ('completed','cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'invalid_status_transition:%:%', v_from_status, p_to_status;
  end if;

  update public.service_appointments
  set status = p_to_status,
      cancellation_reason = case when p_to_status = 'cancelled' then coalesce(nullif(p_note,''), cancellation_reason) else cancellation_reason end,
      updated_at = now()
  where id = v_appointment.id
  returning * into v_appointment;

  insert into public.service_appointment_status_events(
    appointment_id, from_status, to_status, actor_type, actor_user_id, note
  ) values (
    v_appointment.id, v_from_status, p_to_status, p_actor_type, p_actor_user_id, p_note
  );

  return v_appointment;
end;
$$;

revoke all on function public.transition_service_appointment_status(uuid,text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.transition_service_appointment_status(uuid,text,text,uuid,text) to service_role;
