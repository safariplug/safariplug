-- Remove a duplicate composite index on trip_items.
-- trip_items_trip_id_position_idx already covers (trip_id, position).
DROP INDEX IF EXISTS public.trip_items_trip_idx;
