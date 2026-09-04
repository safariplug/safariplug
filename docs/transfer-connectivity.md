# SafariPlug transfer connectivity foundation

Provider-agnostic airport / hotel / point-to-point transfer layer.
**No live transfer supplier is connected.**

Hotel connectivity remains independent. Event catalog is unchanged.

## Two APIs under `/api/v1/transfers`

| Path | Meaning |
|---|---|
| `GET /api/v1/transfers` | Travel OS **catalog** of approved `offerings` (`transfer`, `driver`, `vehicle`). Real DB rows only. Currently empty. Not live availability. |
| `GET /api/v1/transfers/search` | Live **supplier search**. **503** `transfer_inventory_not_configured` until a contract is live. |
| `GET /api/v1/transfers/availability` | Supplier-confirmed availability. **503** today. Never treat a catalog listing as bookable. |
| `POST /api/v1/transfers/quotes` | Supplier quote. **503** today. |

A static approved offering is **not** availability for a date/time.

## Architecture

```
GET /api/v1/transfers/search
  → lib/services/transfers.ts
  → transferProviderRegistry
  → TransferAdapter (search / availability / quote / hold / confirm / cancel)
```

Persistence stays on existing Travel OS tables (`providers`, `offerings`, `bookings`, `price_quotes`, `trips`, `trip_items`). No new tables in this phase.

## Domain

Pickup/drop-off: `airport | hotel | attraction | address | city | coordinates`, plus optional place ID, airport code, hotel property id, city (reuses SafariPlug cities conceptually), lat/lng.

Journey: date, optional time, timezone, duration/distance only if the supplier sends them, one-way / round-trip.

Passengers: adults, children, infants, luggage.

Vehicle (only if supplied): category, name, passenger/luggage capacity, accessibility, private/shared/scheduled/on-demand.

## Adapter / registry

`TransferAdapter` in `lib/integrations/transfers/adapter.ts`.

Statuses: `unavailable | not_configured | configured | healthy | degraded | disabled`.

Live requires implemented contract **and** credentials **and** healthy/configured/degraded. `liveTransferAdapters().length === 0` today.

## Quotes

`prepareQuote()`: supplier amount, markup, commission, tax, fee, customer total, ISO currency, `source: "supplier"` only for supplier amounts. No silent FX.

## Booking lifecycle

SEARCH → AVAILABILITY → QUOTE → HOLD → CONFIRM → BOOKED → MODIFIED / CANCELLED / COMPLETED

`transferConfirm()` always `contract_required`. Clients cannot mark BOOKED. Existing booking RLS unchanged. Hold/confirm need `idempotency_key`. Search may retry on timeout; confirm does not.

## Credentials

`SAFARIPLUG_TRANSFER_<PROVIDER>_BASE_URL`
`SAFARIPLUG_TRANSFER_<PROVIDER>_API_KEY`

Server-only. Env without an implemented adapter does not go live.

## Making a provider live

1. Document the real supplier contract.
2. Implement `TransferAdapter` that actually calls it.
3. `registerTransferAdapter(key, factory)`.
4. Store credentials in server env.
5. Prove search + health against the real/sandbox API.
6. Then `contractImplemented() === true`.

### Live
Actual contract + credentials + successful API test. **None.**

### Configured
Credentials present, contract not implemented. Status `unavailable`.

### Not configured
No credentials. Default.

### Scaffolded
Architecture exists. All listed keys.

## Aurelian

`aurelian` is a transfer registry key only. Existing inbound events pull is unchanged. No Aurelian transfer URL is invented.

## Driver marketplace (future)

`independent_driver` and `safariplug_driver` are registry slots. A future booking may attach provider + vehicle + driver without changing the transfer abstraction. Not built in this phase.

## Admin

`/admin/integrations/transfers` — provider, status, configured, contract, last error. No credentials.
