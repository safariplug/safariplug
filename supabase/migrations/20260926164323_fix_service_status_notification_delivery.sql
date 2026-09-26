create or replace function public.create_service_appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_appointment_time text;
  v_title text;
  v_customer_body text;
  v_provider_body text;
  v_type text;
  v_recipient uuid;
  v_is_reschedule boolean := false;
begin
  select sa.id,
         sa.customer_user_id,
         sa.customer_name,
         sa.staff_id,
         sa.starts_at,
         sp.business_id,
         sp.timezone,
         so.name as service_name,
         b.name as business_name,
         b.owner_id as business_owner_id,
         ss.user_id as staff_user_id
    into a
    from public.service_appointments sa
    join public.service_profiles sp on sp.id = sa.service_profile_id
    join public.service_offerings so on so.id = sa.offering_id
    join public.businesses b on b.id = sp.business_id
    left join public.service_staff ss on ss.id = sa.staff_id
   where sa.id = new.appointment_id;

  if not found then return new; end if;

  v_appointment_time := to_char(
    a.starts_at at time zone coalesce(a.timezone,'UTC'),
    'Mon DD, YYYY at HH12:MI AM'
  );

  v_is_reschedule :=
    new.from_status is not distinct from new.to_status
    and coalesce(new.note,'') ilike '%reschedul%';

  if v_is_reschedule then
    v_type := 'appointment_rescheduled';
    v_title := 'Appointment rescheduled';
    v_customer_body := coalesce(a.service_name,'Appointment')
      || ' at ' || coalesce(a.business_name,'your provider')
      || ' is now scheduled for ' || v_appointment_time || '.';
    v_provider_body := coalesce(a.service_name,'Appointment')
      || ' for ' || coalesce(a.customer_name,'your customer')
      || ' was rescheduled to ' || v_appointment_time || '.';
  else
    v_type := 'appointment_' || new.to_status;
    case new.to_status
      when 'confirmed' then
        v_title := 'Appointment confirmed';
        v_customer_body := coalesce(a.service_name,'Appointment')
          || ' at ' || coalesce(a.business_name,'your provider')
          || ' is confirmed for ' || v_appointment_time || '.';
        v_provider_body := coalesce(a.service_name,'Appointment')
          || ' for ' || coalesce(a.customer_name,'your customer')
          || ' is confirmed for ' || v_appointment_time || '.';
      when 'checked_in' then
        v_title := 'You are checked in';
        v_customer_body := 'You have been checked in for '
          || coalesce(a.service_name,'your appointment')
          || ' at ' || coalesce(a.business_name,'your provider') || '.';
        v_provider_body := coalesce(a.customer_name,'Your customer')
          || ' is checked in for ' || coalesce(a.service_name,'the appointment') || '.';
      when 'in_progress' then
        v_title := 'Service started';
        v_customer_body := coalesce(a.service_name,'Your service')
          || ' at ' || coalesce(a.business_name,'your provider') || ' has started.';
        v_provider_body := coalesce(a.service_name,'Service')
          || ' for ' || coalesce(a.customer_name,'your customer') || ' has started.';
      when 'completed' then
        v_title := 'Appointment completed';
        v_customer_body := coalesce(a.service_name,'Your appointment')
          || ' at ' || coalesce(a.business_name,'your provider') || ' is complete.';
        v_provider_body := coalesce(a.service_name,'Appointment')
          || ' for ' || coalesce(a.customer_name,'your customer') || ' is complete.';
      when 'cancelled' then
        v_title := 'Appointment cancelled';
        v_customer_body := coalesce(a.service_name,'Your appointment')
          || ' at ' || coalesce(a.business_name,'your provider') || ' has been cancelled.';
        v_provider_body := coalesce(a.service_name,'Appointment')
          || ' for ' || coalesce(a.customer_name,'your customer') || ' has been cancelled.';
      when 'no_show' then
        v_title := 'Appointment marked no-show';
        v_customer_body := coalesce(a.service_name,'Your appointment')
          || ' at ' || coalesce(a.business_name,'your provider') || ' was marked as a no-show.';
        v_provider_body := coalesce(a.customer_name,'Customer')
          || ' was marked no-show for ' || coalesce(a.service_name,'the appointment') || '.';
      else
        return new;
    end case;
  end if;

  if a.customer_user_id is not null
     and new.actor_user_id is distinct from a.customer_user_id
     and new.actor_type <> 'customer' then
    insert into public.service_appointment_notifications(user_id,appointment_id,type,title,body)
    values(a.customer_user_id,new.appointment_id,v_type,v_title,v_customer_body);
  end if;

  for v_recipient in
    select distinct recipient_id
    from (
      select sa.user_id as recipient_id
      from public.supplier_accounts sa
      where sa.business_id = a.business_id
      union all
      select a.business_owner_id
      union all
      select a.staff_user_id
    ) recipients
    where recipient_id is not null
      and recipient_id is distinct from a.customer_user_id
      and recipient_id is distinct from new.actor_user_id
  loop
    insert into public.service_appointment_notifications(user_id,appointment_id,type,title,body)
    values(v_recipient,new.appointment_id,v_type,v_title,v_provider_body);
  end loop;

  return new;
end;
$$;

drop trigger if exists service_appointment_status_notification_trigger on public.service_appointment_status_events;
create trigger service_appointment_status_notification_trigger
after insert on public.service_appointment_status_events
for each row execute function public.create_service_appointment_notifications();

revoke all on function public.create_service_appointment_notifications() from public, anon, authenticated;
grant execute on function public.create_service_appointment_notifications() to service_role;
