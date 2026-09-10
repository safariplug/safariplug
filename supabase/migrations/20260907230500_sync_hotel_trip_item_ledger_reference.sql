-- Keep hotel itinerary items linked to the hotel pricing ledger.
-- The current LockTrip confirmation path already writes the ledger id into notes;
-- this trigger promotes that marker into a real foreign-key relationship.

create or replace function public.sync_hotel_trip_item_ledger_reference()
returns trigger
language plpgsql
as $$
declare
  ledger_uuid uuid;
begin
  if new.item_kind = 'hotel' and new.hotel_booking_pricing_ledger_id is null and new.notes is not null then
    begin
      ledger_uuid := substring(new.notes from 'SafariPlug hotel ledger: ([0-9a-fA-F-]{36})')::uuid;
      new.hotel_booking_pricing_ledger_id := ledger_uuid;
    exception when others then
      new.hotel_booking_pricing_ledger_id := null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trip_items_sync_hotel_ledger_reference on public.trip_items;
create trigger trip_items_sync_hotel_ledger_reference
before insert or update on public.trip_items
for each row execute function public.sync_hotel_trip_item_ledger_reference();
