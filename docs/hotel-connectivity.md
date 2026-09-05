# SafariPlug hotel connectivity foundation

Provider-agnostic adapter layer. **No live hotel supplier is connected.**

Public catalog for events is unchanged. Hotels do not reuse event rows.

## Architecture

```
Android / website
        ↓
GET /api/v1/hotels
        ↓
lib/services/hotels.ts
        ↓
lib/integrations/hotels/registry.ts
        ↓
HotelAdapter (search / availability / quote / hold / confirm / cancel)
        ↓
supplier (only when contract_implemented AND credentials AND health)
```

Existing Travel OS tables (`providers`, `offerings`, `bookings`, `price_quotes`) stay the persistence model for a future live supplier. This phase adds **no new tables** and inserts **no fake hotels**.

## Adapter contract

`HotelAdapter` in `lib/integrations/hotels/adapter.ts`.

Capabilities are explicit booleans. A TypeScript class is not a live integration.

Statuses: `unavailable` | `not_configured` | `configured` | `healthy` | `degraded` | `disabled`.

`healthy` is only allowed after a real supplier health/API check.

## Normalized hotel model

Search result: `provider`, `property_id`, `property_name`, `room_id`, `rate_id`, `currency`, `total`, `cancellation`, `availability`, `source: "supplier"`.

Quote uses existing `prepareQuote()`:

- `supplier_amount` / `supplier_currency`
- SafariPlug `markup_amount`
- `commission_amount`
- `tax_amount` / `fee_amount` only when known
- `customer_total` / `customer_currency`
- `source: "supplier"` only for supplier-confirmed amounts

No silent FX conversion. Listed/public prices stay `unconfirmed_listed` on event bookings.

## API

| Method | Path | Production behavior today |
|---|---|---|
| GET | `/api/v1/hotels` | **503** `hotel_inventory_not_configured` |
| GET | `/api/v1/hotels/availability` | **503** same |
| POST | `/api/v1/hotels/quotes` | **503** same |
| GET | `/api/v1/availability` | still **501** (Travel OS, not hotel-specific) |
| POST | `/api/v1/bookings/confirm` | still **501** |

Query: `destination`, `check_in`, `check_out`, `guests`, `rooms`, `currency`.

Never returns an empty hotel list pretending inventory exists. Never returns fabricated properties.

## Credentials

Server-only:

`SAFARIPLUG_HOTEL_<PROVIDER>_BASE_URL`
`SAFARIPLUG_HOTEL_<PROVIDER>_API_KEY`

Not in Android, git, or API responses. Env without an implemented adapter still does **not** make the provider live.

## Booking lifecycle

SEARCH → AVAILABILITY → QUOTE → HOLD → CONFIRM → BOOKED → MODIFIED / CANCELLED / COMPLETED

`hotelConfirm()` always returns `contract_required` until a real supplier confirm path exists. Clients cannot mark a booking BOOKED. Existing booking RLS is unchanged.

Hold/confirm require `idempotency_key`. Search may retry on timeout. Confirm is not retried blindly.

## Making a provider live

1. Document the real supplier API contract.
2. Implement `HotelAdapter` methods that actually call it.
3. `registerHotelAdapter(key, factory)` in server code.
4. Store credentials in Hostinger/server env (never git).
5. Prove a real search and a real health check in tests against recorded/sandbox responses.
6. Only then `contractImplemented() === true` and status may become `configured` / `healthy`.

## Aurelian

`aurelian` is a registry key so a future hotel contract can plug in. The existing inbound events pull (`/api/integrations/aurelian/events`) is unchanged. No Aurelian hotel URL is invented or called.

## Admin

`/admin/integrations/hotels` shows provider / status / configured / contract / last error. Credentials are not displayed.
