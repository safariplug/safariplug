# SafariPlug → Growth OS first-party event relay

SafariPlug sends privacy-safe production intent and conversion events to Growth OS through the SafariPlug server. Browsers never receive the shared secret.

## Required server environment

Set these on the production SafariPlug Web App:

- `SAFARIPLUG_EVENT_SECRET` — shared secret; must exactly match the value configured on Growth OS.
- `SAFARIPLUG_GROWTH_EVENTS_URL` — optional. Defaults to `https://growth.safariplug.com/api/events`.

Set the same `SAFARIPLUG_EVENT_SECRET` on the Growth OS Web App.

Do not expose either variable through a `NEXT_PUBLIC_` or `VITE_` prefix.

## Events

Browser-safe relay:
- SEARCH
- PRODUCT_VIEW
- PRODUCT_CLICK
- BOOKING_START

Trusted transaction server only:
- BOOKING_COMPLETE
- REVENUE

No guest names, email addresses, phone numbers, or raw SafariPlug user IDs are sent to Growth OS.

## Failure behavior

Growth telemetry is non-blocking. If the Growth OS collector is unavailable or the relay is not configured, SafariPlug search and booking behavior continues normally. Confirmed booking state remains owned by SafariPlug's booking ledger.
