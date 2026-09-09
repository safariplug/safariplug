create or replace function public.protect_trip_item_service_appointment_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.appointment_id is not null then
      if new.trip_id is distinct from old.trip_id
         or new.appointment_id is distinct from old.appointment_id
         or new.item_kind is distinct from old.item_kind
         or new.title is distinct from old.title
         or new.start_at is distinct from old.start_at
         or new.end_at is distinct from old.end_at
         or new.city_id is distinct from old.city_id then
        raise exception 'service_appointment_trip_item_immutable';
      end if;
    elsif new.appointment_id is not null then
      raise exception 'service_appointment_trip_item_attach_requires_rpc';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_trip_item_service_appointment_mutation() from public, anon, authenticated;
grant execute on function public.protect_trip_item_service_appointment_mutation() to service_role;

drop trigger if exists protect_trip_item_service_appointment_mutation on public.trip_items;
create trigger protect_trip_item_service_appointment_mutation
before update on public.trip_items
for each row execute function public.protect_trip_item_service_appointment_mutation();
