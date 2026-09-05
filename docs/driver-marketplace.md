# SafariPlug driver marketplace

Provider-neutral driver + vehicle + transfer-assignment layer.
**No fake inventory.** Production driver tables are real, but remain empty until legitimate drivers are onboarded.

Hotel and transfer connectivity remain independent. Event catalog is unchanged.

## Implemented

- Driver domain, vehicle relationship, capabilities, service areas, availability slots
- Supabase-backed admin inventory for drivers, vehicles and availability
- Assignment state machine linked to Travel OS bookings
- Deterministic eligibility
- Provider adapter registry (`liveDriverAdapters().length === 0` until a real provider contract is configured)
- Admin operations console at `/admin/integrations/drivers`
- Verification workflow tables and trust checks
- Production migration `20260904044100_driver_marketplace` is applied

## Live inventory

The production tables currently contain **zero drivers, zero vehicles and zero availability slots**. The console is ready for real onboarding; it does not seed demo records.

## Verification gate

New drivers are created as `pending` + `unverified`. Admins may maintain operational status, but **verification is a separate trust workflow**. A driver is bookable only when service status is `active` and trust status is `verified`.

The verification data model supports private verification cases and opaque evidence references. Raw identity documents and identity numbers are not stored in the driver marketplace tables.

## Domain

`pending | active | inactive | suspended | off_duty`

`verification_state`: `unverified | pending | verified | rejected`

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

Assignment is allowed only when `bookings.status` is `confirmed` or `booked`. Quotes cannot receive a driver.

Preferred driver is a ranking hint only. It cannot override inactive, unverified, capacity, availability, service-area, or capability rules.

## Eligibility

Rejects: inactive/pending/suspended/off_duty, unverified, missing vehicle, capacity mismatch, no availability slot, service-area mismatch, capability mismatch, already assigned.

## Security

- **No** public `GET /api/v1/drivers`
- Public users cannot create, activate, verify, or assign drivers
- Travelers cannot self-assign
- `contact_ref` is opaque and omitted from public assigned-driver fields
- Driver, vehicle, availability and assignment tables use RLS with service-role-only grants
- Credentials remain server-only
- No raw identity documents or identity numbers are stored

## Persistence

Existing `providers` / `offerings` / `bookings` are not duplicated.

Production tables:

- `driver_profiles`
- `vehicles`
- `driver_availability`
- `driver_assignments`

Admin CRUD uses the server-side Supabase client. Business-rule tests may still use `MemoryDriverStore` fixtures; production driver inventory is no longer represented by that in-memory store.

## Tracking

A future location event can attach `driver_id`, `vehicle_id`, `assignment_id`, `booking_id`, coordinates, timestamp. **No location is collected now. No Android tracking permissions.**

## Aurelian

`aurelian_driver` is a registry key. Existing SafariPlug → Aurelian event feed behavior is unchanged. No Aurelian driver URL is invented.

## Adapter

`DriverAdapter`: listDrivers, getDriver, availability, assign, unassign.

A class is not live. Live requires implemented contract **and** credentials **and** healthy/configured/degraded.

## Next operational phase

The remaining major work is wiring the Supabase-backed driver store into the transfer fulfillment service so confirmed/booked transfer bookings can actually select and persist eligible drivers. That must happen without weakening the verification gate or creating synthetic driver inventory.
