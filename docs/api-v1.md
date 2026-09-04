# SafariPlug public API v1

Additive Next.js route handlers. The production website is unchanged.
The database (Supabase/PostgreSQL) is the only catalog source.

Base path: `/api/v1`

## Envelope

Success:

```json
{ "success": true, "data": {}, "meta": { "page": 1, "limit": 20, "total": 0 } }
```

Error:

```json
{ "success": false, "error": { "code": "bad_request", "message": "..." } }
```

HTTP status: `200`, `201`, `400`, `401`, `404`, `409`, `500`, `501`, `503`.

`error.code` values: `bad_request`, `unauthorized`, `not_found`, `conflict`, `configuration_error`, `unavailable`, `internal_error`.

Database errors, SQL, stack traces, and secret names are never returned.

## Client

Server-side Supabase JS client with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Same public access path as `/events`. Service role is not used.

Missing public config → `503 configuration_error`.

## Public event status

`events.status = approved` on every catalog query.
Pending, rejected, expired, and AI Scout staging rows are not returned.

Default date rule (`when=valid`, homepage / Phase 2A):

`end_at >= now OR (end_at is null AND start_at >= now)`

Optional `when`: `upcoming` (`start_at >= now`, `/events` default), `tonight`, `this-weekend`, `all` (approved only).

## Routes

### GET /api/v1/events

Query: `page`, `limit` (1–50, default 20), `city`, `category`, `featured`, `when`.

Tables: `events`, `cities` (embed + optional city lookup).

### GET /api/v1/events/{id}

UUID required. `404` if missing or not approved.

### GET /api/v1/destinations

`cities` where `active = true`, plus approved still-valid event counts.

### GET /api/v1/experiences

Not a new table. Returns:

- `collections`: existing `/experiences/{slug}` public pages
- `categories`: existing `EVENT_CATEGORIES`, counted from approved events

### GET /api/v1/search?q=

Approved still-valid events. `ilike` on title, description, venue_name, category, city.
`q` required, max 80 characters. Filter metacharacters stripped.

## Public event fields

`id`, `title`, `description`, `category`, `start_at`, `end_at`, `venue_name`,
`venue_address`, `price`, `currency`, `image_url`, `booking_url`,
`organizer_name`, `is_featured`, `status`, `city`.

Never returned: `organizer_contact`, `submitted_by`, `ai_confidence`,
`source_type`, `source_url`, `verified`, `verified_at`, admin users,
partner records, AI Scout rows, service-role or provider keys.

No `/health` endpoint.

No `/api/v1/auth/*`. Mobile auth stays on Supabase Auth later.

## Travel OS foundation

Public catalog for events/experiences/destinations is unchanged.

Additional `/api/v1` routes:

| Method | Path | Auth | Live inventory |
|---|---|---|---|
| GET | `/api/v1/providers` | public | empty until active providers exist |
| GET | `/api/v1/providers/{id}` | public | 404 if not active |
| GET | `/api/v1/services` | public | empty `offerings` (`personal_service`, `adventure`, `activity`, `safari`, `tour`) |
| GET | `/api/v1/transfers` | public | catalog `offerings` (`transfer`, `driver`, `vehicle`); empty until real rows exist |
| GET | `/api/v1/transfers/search` | public | **503** `transfer_inventory_not_configured` until a live supplier exists |
| GET | `/api/v1/transfers/availability` | public | **503** same; not a catalog listing |
| POST | `/api/v1/transfers/quotes` | public | **503** same |

`error.code` also includes `transfer_inventory_not_configured`.

| GET | `/api/v1/trips` | Bearer | traveler's trips |
| POST | `/api/v1/trips` | Bearer | draft trip |
| POST | `/api/v1/trips/{id}/items` | Bearer | attach approved event |
| GET | `/api/v1/bookings` | Bearer | traveler's bookings |
| POST | `/api/v1/bookings` | Bearer | quote only; requires approved `event_id`; listed price is unconfirmed |
| POST | `/api/v1/bookings/confirm` | any | **501** no provider contract |
| GET | `/api/v1/availability` | any | **501** no availability contract |
| GET | `/api/v1/hotels` | public | **503** `hotel_inventory_not_configured` until a live supplier exists |
| GET | `/api/v1/hotels/availability` | public | **503** same (does not change Travel OS `/availability`) |
| POST | `/api/v1/hotels/quotes` | public | **503** same |

`error.code` also includes `hotel_inventory_not_configured`.


`error.code` also includes `unauthorized`, `unavailable`, and `conflict`.

POST `/api/v1/bookings` ignores client-supplied amounts. It copies `events.price`/`currency` as `price_source=unconfirmed_listed`.

Public driver directory is intentionally omitted. There is no `GET /api/v1/drivers`.
Driver assignment is an internal/admin service (`lib/services/drivers.ts`).
Verification cases and evidence are admin-only (`/api/admin/verification`). They are not part of `/api/v1`.
