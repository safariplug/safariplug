create or replace function public.validate_service_appointment_time_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.service_profiles;
  v_staff public.service_staff;
  v_offering public.service_offerings;
  v_local_start timestamp;
  v_local_end timestamp;
  v_day smallint;
  v_start_time time;
  v_end_time time;
begin
  if tg_op = 'UPDATE' and new.starts_at is not distinct from old.starts_at and new.ends_at is not distinct from old.ends_at then
    return new;
  end if;

  select * into v_profile from public.service_profiles where id = new.service_profile_id and status = 'active' and booking_status = 'open';
  if not found then raise exception 'service_not_bookable'; end if;

  select * into v_staff from public.service_staff where id = new.staff_id and service_profile_id = new.service_profile_id and status = 'active';
  if not found then raise exception 'staff_not_bookable'; end if;

  select * into v_offering from public.service_offerings where id = new.offering_id and service_profile_id = new.service_profile_id and status = 'active';
  if not found then raise exception 'service_not_bookable'; end if;

  if new.ends_at <= new.starts_at then raise exception 'invalid_appointment_time'; end if;
  if new.starts_at < now() + make_interval(mins => v_profile.booking_notice_minutes) then raise exception 'booking_notice_violation'; end if;
  if new.starts_at > now() + make_interval(days => v_profile.max_booking_days) then raise exception 'booking_window_violation'; end if;

  v_local_start := new.starts_at at time zone v_profile.timezone;
  v_local_end := new.ends_at at time zone v_profile.timezone;
  if v_local_end::date <> v_local_start::date then raise exception 'staff_unavailable'; end if;
  v_day := extract(dow from v_local_start)::smallint;
  v_start_time := v_local_start::time;
  v_end_time := v_local_end::time;

  if not exists (
    select 1 from public.service_staff_availability sa
    where sa.staff_id = new.staff_id and sa.is_active = true and sa.day_of_week = v_day
      and sa.start_time <= v_start_time and sa.end_time >= v_end_time
  ) then raise exception 'staff_unavailable'; end if;

  if exists (
    select 1 from public.service_staff_blockouts
    where staff_id = new.staff_id and starts_at < new.ends_at and ends_at > new.starts_at
  ) then raise exception 'staff_unavailable'; end if;

  return new;
end;
$$;

revoke all on function public.validate_service_appointment_time_window() from public, anon, authenticated;
grant execute on function public.validate_service_appointment_time_window() to service_role;

drop trigger if exists service_appointments_validate_time_window on public.service_appointments;
create trigger service_appointments_validate_time_window
before insert or update of starts_at, ends_at, staff_id, service_profile_id, offering_id
on public.service_appointments
for each row execute function public.validate_service_appointment_time_window();
