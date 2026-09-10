create table if not exists public.service_appointment_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid not null references public.service_appointments(id) on delete cascade,
  type text not null default 'appointment_status',
  title text not null,
  body text not null,
  status text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists service_appointment_notifications_user_idx
  on public.service_appointment_notifications(user_id, created_at desc);
create index if not exists service_appointment_notifications_appointment_idx
  on public.service_appointment_notifications(appointment_id, created_at desc);

alter table public.service_appointment_notifications enable row level security;

drop policy if exists service_appointment_notifications_customer_select on public.service_appointment_notifications;
create policy service_appointment_notifications_customer_select
  on public.service_appointment_notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists service_appointment_notifications_customer_update on public.service_appointment_notifications;
create policy service_appointment_notifications_customer_update
  on public.service_appointment_notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.create_service_appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.service_appointments;
  supplier_user_id uuid;
  customer_user_id uuid;
  service_name text;
  business_name text;
  when_text text;
begin
  select * into a from public.service_appointments where id = new.appointment_id;
  if not found then return new; end if;

  select so.name into service_name
    from public.service_offerings so
   where so.id = a.offering_id;

  select b.name into business_name
    from public.businesses b
    join public.service_profiles sp on sp.business_id = b.id
   where sp.id = a.service_profile_id;

  customer_user_id := a.customer_user_id;
  select sa.user_id into supplier_user_id
    from public.supplier_accounts sa
    join public.service_profiles sp on sp.business_id = sa.business_id
   where sp.id = a.service_profile_id
   limit 1;

  when_text := to_char(a.starts_at at time zone 'UTC', 'Mon DD, YYYY HH24:MI UTC');

  if customer_user_id is not null and new.actor_type <> 'customer' then
    insert into public.service_appointment_notifications(user_id, appointment_id, title, body, status)
    values (
      customer_user_id,
      a.id,
      case new.to_status
        when 'confirmed' then 'Appointment confirmed'
        when 'checked_in' then 'You have been checked in'
        when 'in_progress' then 'Your service has started'
        when 'completed' then 'Appointment completed'
        when 'cancelled' then 'Appointment cancelled'
        when 'no_show' then 'Appointment marked no-show'
        else 'Appointment updated'
      end,
      coalesce(service_name, 'Your service') || ' with ' || coalesce(business_name, 'your provider') || ' · ' || when_text,
      new.to_status
    );
  end if;

  if supplier_user_id is not null and new.actor_type <> 'provider' then
    insert into public.service_appointment_notifications(user_id, appointment_id, title, body, status)
    values (
      supplier_user_id,
      a.id,
      case new.to_status
        when 'cancelled' then 'Customer cancelled an appointment'
        when 'confirmed' then 'Customer appointment confirmed'
        when 'pending' then 'New appointment'
        else 'Appointment updated'
      end,
      coalesce(a.customer_name, 'Customer') || ' · ' || coalesce(service_name, 'Service') || ' · ' || when_text,
      new.to_status
    );
  end if;

  return new;
end;
$$;

drop trigger if exists service_appointment_status_notification_trigger on public.service_appointment_status_events;
create trigger service_appointment_status_notification_trigger
after insert on public.service_appointment_status_events
for each row execute function public.create_service_appointment_notifications();
