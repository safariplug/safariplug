# SafariPlug driver marketplace foundation

Provider-neutral driver + vehicle + transfer-assignment layer.
**No live drivers exist. No fake inventory.**

Hotel and transfer connectivity remain independent. Event catalog is unchanged.

## Implemented (architecture)

- Driver domain, vehicle relationship, capabilities, service areas, availability slots
- Assignment state machine linked to Travel OS bookings
- Deterministic eligibility
- Provider adapter registry (`liveDriverAdapters().length === 0`)
- Admin observability at `/admin/integrations/drivers`
- Additive migration `supabase/migrations/20260906_driver_marketplace.sql` (**not applied**)

## Live

None.

## Not configured

Default. No driver provider credentials. Empty production store.

## Future

Verification / KYC, GPS tracking, payments/payouts, ratings, driver app, customer driver-discovery UI.

## Domain

`pending | active | inactive | suspended | off_duty`

`verification_state`: `unverified | pending | verified | rejected`

New records default to `pending` + `unverified`. Bookable requires **active and verified**. This phase **cannot** mark a driver verified (DB trigger + service check).

Provider types: independent_driver, safariplug_driver, transport_company, hotel_driver, tour_operator, aurelian_driver, external_driver_provider.

Capabilities: airport_transfer, hotel_transfer, long_distance, city_transfer, child_seat, wheelchair_accessible, large_luggage, premium_vehicle.

Service areas reuse SafariPlug city / airport / country / optional radius. No second GIS database.

Vehicles: category, make/model, passenger/luggage capacity, accessibility, status. **No license plates, no registration documents, no verification claim.**

## Assignment

```
Transfer search → availability → quote → booking
  → findEligibleDrivers
  → assignDriver / reassignDriver / releaseDriver
  → driver accepts
  → fulfillment
```

Assignment statuses: assigned, reassigned, accepted, declined, cancelled, released, completed.

Customer `bookings.status` is **not** mutated by assignment.

Assignment is allowed only when `bookings.status` is `confirmed` or `booked`. Quotes cannot receive a driver. Today there are no live transfer bookings, so no assignment occurs.

Preferred driver is a ranking hint only. It cannot override inactive, unverified, capacity, availability, service-area, or capability rules.

## Eligibility

Rejects: inactive/pending/suspended/off_duty, unverified, missing vehicle, capacity mismatch, no availability slot, service-area mismatch, capability mismatch, already assigned.

## Security

- **No** `GET /api/v1/drivers`
- Public users cannot create, activate, verify, or assign drivers
- Travelers cannot self-assign
- `contact_ref` is opaque and omitted from public assigned-driver fields
- RLS on new tables: enable + **no** anon/authenticated grants (service_role only)
- Existing booking/trip RLS unchanged
- Credentials: `SAFARIPLUG_DRIVER_<PROVIDER>_BASE_URL` / `_API_KEY` server-only

## Persistence

Existing `providers` / `offerings` / `bookings` are not duplicated.

New tables (migration, unapplied):

- `driver_profiles`
- `vehicles`
- `driver_availability`
- `driver_assignments`

In-process `MemoryDriverStore` is empty in production. Tests inject fixtures only.

`driver_forbid_verified` blocks `verification_state = 'verified'` until a later verification migration.

## Tracking (architecture only)

A future location event can attach `driver_id`, `vehicle_id`, `assignment_id`, `booking_id`, coordinates, timestamp. **No location is collected now. No Android tracking permissions.**

## Aurelian

`aurelian_driver` is a registry key. Existing inbound events pull is unchanged. No Aurelian driver URL is invented.

## Adapter

`DriverAdapter`: listDrivers, getDriver, availability, assign, unassign.

A class is not live. Live requires implemented contract **and** credentials **and** healthy/configured/degraded.
