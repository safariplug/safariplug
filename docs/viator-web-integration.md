# Viator web integration

SafariPlug integrates Viator as a separate web-only experience provider.

## Current scope

- Web app only for the initial certification.
- Affiliate account: P00322796.
- Full + Booking Access has been requested and is awaiting Viator review.
- USD-only presentation for Viator inventory.
- SafariPlug KES/M-Pesa products remain separate.
- The hosted checkout URL reserved for the certified payment iframe is `/checkout/viator`.
- Booking endpoints are implemented behind a hard feature gate and remain disabled until Viator enables Booking sandbox access.

## Environment variables

```
VIATOR_API_KEY=
VIATOR_ENV=sandbox
VIATOR_BOOKING_ENABLED=false
```

Keep `VIATOR_ENV=sandbox` throughout development and certification.

Keep `VIATOR_BOOKING_ENABLED=false` until Viator enables the Booking sandbox endpoints. When access is granted, set it to `true` in the sandbox environment only. Production must remain disabled until certification and production approval are complete.

## API conventions

All Viator Partner API calls use:

- `exp-api-key`
- `Accept-Language: en-US`
- `Accept: application/json;version=2.0`
- 120-second request timeout

Sandbox base URL: `https://api.sandbox.viator.com/partner`.

Production base URL: `https://api.viator.com/partner`.

## SafariPlug API bridge

Basic read actions:

- `GET /api/v1/activities/viator?action=status`
- `GET /api/v1/activities/viator?action=destinations&q=Nairobi`
- `GET /api/v1/activities/viator?action=product&code=<productCode>`

Booking certification actions, feature-gated by `VIATOR_BOOKING_ENABLED`:

- `POST /api/v1/activities/viator?action=availability` → `/availability/check`
- `POST /api/v1/activities/viator?action=hold` → `/bookings/cart/hold`
- `POST /api/v1/activities/viator?action=book` → `/bookings/cart/book`
- `POST /api/v1/activities/viator?action=booking-status` → `/bookings/status`
- `GET /api/v1/activities/viator?action=cancel-reasons` → `/bookings/cancel-reasons`
- `POST /api/v1/activities/viator?action=cancel-quote&bookingReference=<ref>`
- `POST /api/v1/activities/viator?action=cancel&bookingReference=<ref>`

The bridge passes Viator request payloads through rather than inventing request fields before Booking sandbox access is available. This keeps the implementation aligned with the exact schemas enabled for SafariPlug's account.

## Certified payment flow

1. Customer selects date, product option and passenger mix.
2. Real-time `/availability/check`.
3. If price changed, display and use the new Viator price.
4. `/bookings/cart/hold` at checkout.
5. Render the Viator Secure Payment iFrame using `paymentDataSubmissionMode: "VIATOR_FORM"` and the SafariPlug HTTPS hosting URL.
6. `/bookings/cart/book`.
7. Verify booking status before showing confirmation.
8. Share the Viator voucher returned by the booking response.
9. For `PENDING` bookings, reconcile using `/bookings/status` at the Viator-approved cadence.
10. For cancellation, get cancellation reasons, request a cancellation quote, show the refund amount, then cancel via the API.

## Certification test products supplied by Viator

- Instant confirmation: `100337P2`, `9025P51`
- Pending/manual confirmation: `11612P1`
- Passenger mix/age bands: `177458P2`, `200006P21`
- Booking questions/logistics: `5516ST5`, `9811P2`, `335316P4`, `101650P10`
- Cancellation policies: `3991MB_ATVM`, `40944P355`, `100014P7`

## Still blocked on Viator approval

Do not enable or fake the following until Booking sandbox access is active:

- Secure payment iFrame initialization and payment session handling.
- Real booking holds and booking submissions.
- Booking status reconciliation against transactional sandbox data.
- Cancellation requests against transactional sandbox data.

Once Booking sandbox access is active, capture request/response logs, tracking IDs, screenshots, voucher display, pending-booking behavior, cancellation quote/cancel evidence, and PCI DSS SAQ A evidence for certification.
