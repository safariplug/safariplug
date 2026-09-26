create or replace function public.expire_abandoned_service_appointments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select a.id
    from public.service_appointments a
    where a.status in ('pending','confirmed')
      and a.payment_status in ('unpaid','failed')
      and a.updated_at < now() - interval '30 minutes'
      and not exists (
        select 1
        from public.service_payment_idempotency i
        where i.appointment_id = a.id
          and (
            i.attempt_active = true
            or i.provider_submission_state in ('submitted','uncertain')
            or (i.processing_until is not null and i.processing_until > now())
          )
      )
    order by a.updated_at asc
    for update of a skip locked
  loop
    begin
      perform public.transition_service_appointment_status(
        r.id,
        'cancelled',
        'system',
        null,
        'Booking expired after 30 minutes without a completed or active payment attempt.'
      );
      v_count := v_count + 1;
    exception
      when others then
        raise notice 'Unable to expire abandoned service appointment %: %', r.id, sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.expire_abandoned_service_appointments() from public, anon, authenticated;
grant execute on function public.expire_abandoned_service_appointments() to service_role;

create or replace function public.clear_service_appointment_reminders_on_terminal_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
     and new.status in ('cancelled','no_show') then
    delete from public.service_appointment_notifications
    where appointment_id = new.id
      and type in ('service_appointment_reminder_24h','service_appointment_reminder_2h');
  end if;
  return new;
end;
$$;

drop trigger if exists service_appointments_clear_future_reminders on public.service_appointments;
create trigger service_appointments_clear_future_reminders
after update of status on public.service_appointments
for each row execute function public.clear_service_appointment_reminders_on_terminal_status();

revoke all on function public.clear_service_appointment_reminders_on_terminal_status() from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'service-abandoned-booking-expiry' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'service-abandoned-booking-expiry',
    '*/10 * * * *',
    'select public.expire_abandoned_service_appointments();'
  );
end;
$$;
