-- Link confirmed hotel bookings directly to the unified trip itinerary.
-- The ledger remains the source of truth for hotel pricing/payment state.

alter table public.trip_items
  add column if not exists hotel_booking_pricing_ledger_id uuid;

alter table public.trip_items
  drop constraint if exists trip_items_hotel_booking_pricing_ledger_id_fkey;

alter table public.trip_items
  add constraint trip_items_hotel_booking_pricing_ledger_id_fkey
  foreign key (hotel_booking_pricing_ledger_id)
  references public.hotel_booking_pricing_ledger(id)
  on delete set null;

create index if not exists trip_items_hotel_ledger_idx
  on public.trip_items(hotel_booking_pricing_ledger_id)
  where hotel_booking_pricing_ledger_id is not null;
