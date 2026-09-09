-- Keep itinerary timing synchronized when a booked service is rescheduled.
-- The appointment is the source of truth; this trigger prevents stale journey times
-- even when an appointment is changed outside the customer UI.
create or replace function public.sync_service_appointment_journey_times()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at then
    update public.trip_items
    set start_at = new.starts_at,
        end_at = new.ends_at
    where service_appointment_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_service_appointment_journey_times on public.service_appointments;
create trigger sync_service_appointment_journey_times
after update of starts_at, ends_at on public.service_appointments
for each row
execute function public.sync_service_appointment_journey_times();

revoke all on function public.sync_service_appointment_journey_times() from public, anon, authenticated;
