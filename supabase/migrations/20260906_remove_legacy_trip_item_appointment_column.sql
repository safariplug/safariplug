-- The canonical service appointment relation is trip_items.appointment_id.
-- The legacy service_appointment_id column is unused by application code and has no data.
alter table public.trip_items drop constraint if exists trip_items_service_appointment_id_fkey;
drop index if exists public.trip_items_service_appointment_unique_idx;
alter table public.trip_items drop column if exists service_appointment_id;
