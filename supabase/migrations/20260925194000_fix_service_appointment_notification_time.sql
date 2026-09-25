-- Use the booked appointment start time in traveler/provider status notifications.
-- The previous trigger formatted the status-event created_at timestamp, which could
-- tell travelers that an appointment was confirmed "for" the time it was confirmed
-- instead of the actual scheduled appointment time.

create or replace function public.create_service_appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  a record;
  offering_name text;
  business_name text;
  appointment_time text;
  customer_user_id uuid;
  supplier_user_id uuid;
  notification_title text;
  notification_body text;
  notification_type text;
begin
  select sa.*, sp.business_id, sp.timezone, so.name as service_name
    into a
    from public.service_appointments sa
    join public.service_profiles sp on sp.id = sa.service_profile_id
    join public.service_offerings so on so.id = sa.offering_id
   where sa.id = new.appointment_id;

  if not found then return new; end if;

  offering_name := coalesce(a.service_name, 'Appointment');
  select b.name into business_name
    from public.businesses b
   where b.id = a.business_id;

  customer_user_id := a.customer_user_id;

  select sa.user_id into supplier_user_id
    from public.supplier_accounts sa
   where sa.business_id = a.business_id
   limit 1;

  appointment_time := to_char(
    a.starts_at at time zone coalesce(a.timezone, 'UTC'),
    'Mon DD, YYYY at HH12:MI AM'
  );
  notification_type := 'appointment_' || new.to_status;

  case new.to_status
    when 'confirmed' then
      notification_title := 'Appointment confirmed';
      notification_body := offering_name || ' at ' || coalesce(business_name, 'your provider') || ' is confirmed for ' || appointment_time || '.';
    when 'checked_in' then
      notification_title := 'You are checked in';
      notification_body := 'You have been checked in for ' || offering_name || ' at ' || coalesce(business_name, 'your provider') || '.';
    when 'in_progress' then
      notification_title := 'Service started';
      notification_body := offering_name || ' at ' || coalesce(business_name, 'your provider') || ' has started.';
    when 'completed' then
      notification_title := 'Appointment completed';
      notification_body := offering_name || ' at ' || coalesce(business_name, 'your provider') || ' is complete.';
    when 'cancelled' then
      notification_title := 'Appointment cancelled';
      notification_body := offering_name || ' at ' || coalesce(business_name, 'your provider') || ' has been cancelled.';
    when 'no_show' then
      notification_title := 'Appointment marked no-show';
      notification_body := offering_name || ' at ' || coalesce(business_name, 'your provider') || ' was marked as a no-show.';
    else
      return new;
  end case;

  if customer_user_id is not null and new.actor_type <> 'customer' then
    insert into public.service_appointment_notifications(
      user_id, appointment_id, type, title, body
    )
    values (
      customer_user_id, new.appointment_id, notification_type,
      notification_title, notification_body
    );
  end if;

  if supplier_user_id is not null and new.actor_type <> 'provider' then
    insert into public.service_appointment_notifications(
      user_id, appointment_id, type, title, body
    )
    values (
      supplier_user_id, new.appointment_id, notification_type,
      notification_title, notification_body
    );
  end if;

  return new;
end;
$$;
