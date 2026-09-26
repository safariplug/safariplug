
create or replace function public.generate_service_appointment_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_type text;
  v_title text;
  v_customer_body text;
  v_provider_body text;
  v_local_time text;
  v_business_name text;
  v_business_owner uuid;
  v_staff_user uuid;
  v_recipient uuid;
  v_inserted integer := 0;
begin
  for a in
    select sa.id,
           sa.customer_user_id,
           sa.customer_name,
           sa.staff_id,
           sa.starts_at,
           sa.service_profile_id,
           so.name as service_name,
           sp.business_id,
           sp.timezone
    from public.service_appointments sa
    join public.service_offerings so on so.id = sa.offering_id
    join public.service_profiles sp on sp.id = sa.service_profile_id
    where sa.status = 'confirmed'
      and sa.starts_at > now() + interval '1 hour'
      and sa.starts_at <= now() + interval '25 hours'
  loop
    if a.starts_at > now() + interval '23 hours'
       and a.starts_at <= now() + interval '25 hours' then
      v_type := 'service_appointment_reminder_24h';
      v_title := 'Appointment tomorrow';
    elsif a.starts_at > now() + interval '1 hour'
       and a.starts_at <= now() + interval '3 hours' then
      v_type := 'service_appointment_reminder_2h';
      v_title := 'Appointment coming up';
    else
      continue;
    end if;

    select b.name,b.owner_id
      into v_business_name,v_business_owner
    from public.businesses b
    where b.id = a.business_id;

    select ss.user_id into v_staff_user
    from public.service_staff ss
    where ss.id = a.staff_id;

    v_local_time := to_char(
      a.starts_at at time zone coalesce(a.timezone,'UTC'),
      'Mon DD, YYYY at HH12:MI AM'
    );

    v_customer_body := coalesce(a.service_name,'Your service')
      || ' at ' || coalesce(v_business_name,'your provider')
      || ' is scheduled for ' || v_local_time || '.';

    v_provider_body := coalesce(a.service_name,'Service appointment')
      || ' for ' || coalesce(a.customer_name,'your customer')
      || ' is scheduled for ' || v_local_time || '.';

    if a.customer_user_id is not null
       and not exists (
         select 1 from public.service_appointment_notifications n
         where n.user_id = a.customer_user_id
           and n.appointment_id = a.id
           and n.type = v_type
       ) then
      insert into public.service_appointment_notifications(user_id,appointment_id,type,title,body)
      values(a.customer_user_id,a.id,v_type,v_title,v_customer_body);
      v_inserted := v_inserted + 1;
    end if;

    for v_recipient in
      select distinct recipient_id
      from (
        values (v_staff_user),(v_business_owner)
      ) as recipients(recipient_id)
      where recipient_id is not null
        and recipient_id is distinct from a.customer_user_id
    loop
      if not exists (
        select 1 from public.service_appointment_notifications n
        where n.user_id = v_recipient
          and n.appointment_id = a.id
          and n.type = v_type
      ) then
        insert into public.service_appointment_notifications(user_id,appointment_id,type,title,body)
        values(v_recipient,a.id,v_type,v_title,v_provider_body);
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.generate_service_appointment_reminders() from public, anon, authenticated;
grant execute on function public.generate_service_appointment_reminders() to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'service-appointment-reminders'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'service-appointment-reminders',
    '0 * * * *',
    'select public.generate_service_appointment_reminders();'
  );
end;
$$;
