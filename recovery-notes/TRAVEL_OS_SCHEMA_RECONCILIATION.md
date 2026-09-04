# Travel OS schema reconciliation

- Live Supabase project already has the Travel OS tables and migrations applied: integration_syncs, trips, bookings, trip_items, providers, offerings, driver_profiles, vehicles, driver_availability, driver_assignments, verification_cases, verification_evidence, verification_events.
- Live `public.events` has `city_id` and the `cities` relation, but does NOT have a `city` text column.
- Therefore the recovered Aurelian payload selector must not request `events.city`.
- `integration_syncs` has a unique constraint on `(provider, safariplug_event_id)`, so the recovered upsert conflict target is valid.
- Live database has no `trip_days` table; the recovered Travel OS implementation must remain trip/trip_items based unless a future migration explicitly introduces trip_days.
- Driver service logic in the recovered code is currently an in-memory foundation, while the database has the marketplace schema. Do not represent it as live driver inventory until persistence is wired.
- Security advisors currently report SECURITY DEFINER functions exposed in `public` and RLS policy optimization items. These are existing database concerns and should be handled deliberately, not by weakening authorization in application code.
