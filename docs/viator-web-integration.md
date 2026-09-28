# Viator web integration

SafariPlug is integrating Viator as a separate web-only experience provider.

## Current scope

- Web app only.
- Viator Basic sandbox access first.
- USD-only presentation for Viator inventory.
- SafariPlug KES/M-Pesa products remain separate.
- No Viator booking, booking hold, cancellation or payment calls are enabled until Full + Booking Access is approved.
- The hosted checkout URL reserved for the certified payment iframe is `/checkout/viator`.

## Environment variables

```
VIATOR_API_KEY=
VIATOR_ENV=sandbox
VIATOR_BOOKING_ENABLED=false
```

`VIATOR_ENV` must stay `sandbox` while developing and certifying. Production endpoints must not be used for testing.

Set `VIATOR_BOOKING_ENABLED=true` only after Viator approves Full + Booking Access and the hold/payment/book flow has been implemented and certified.

## API conventions

All Viator Partner API v2 calls use:

- `exp-api-key`
- `Accept-Language: en-US`
- `Accept: application/json;version=2.0`

Sandbox base URL: `https://api.sandbox.viator.com/partner`.

Production base URL: `https://api.viator.com/partner`.

## Current endpoints

- `GET /api/v1/activities/viator?action=status`
- `GET /api/v1/activities/viator?action=destinations&q=Nairobi`
- `GET /api/v1/activities/viator?action=product&code=<productCode>`

## Booking phase after approval

The next certified phase will implement:

1. Real-time availability and USD pricing.
2. `/bookings/cart/hold`.
3. Viator Secure Payment iframe with `paymentDataSubmissionMode: "VIATOR_FORM"`.
4. SafariPlug HTTPS `hostingUrl`.
5. `/bookings/cart/book`.
6. Booking status reconciliation.
7. Cancellation quote and cancellation.
8. Certification logs/screenshots and PCI DSS SAQ A evidence.

Do not convert or label Viator selling prices as approximate KES prices.
