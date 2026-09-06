# M-Pesa provider payouts

SafariPlug provider payouts use Safaricom Daraja B2C. Customer collection and provider disbursement are separate payment flows.

## Required server secrets

```text
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_B2C_INITIATOR_NAME=
MPESA_B2C_SECURITY_CREDENTIAL=
MPESA_B2C_CALLBACK_SECRET=
MPESA_B2C_QUEUE_TIMEOUT_URL=https://www.safariplug.com/api/services/payouts/mpesa/timeout?token=<callback-secret>
MPESA_B2C_RESULT_URL=https://www.safariplug.com/api/services/payouts/mpesa/result?token=<callback-secret>
MPESA_BASE_URL=https://sandbox.safaricom.co.ke
```

For production, use the approved Safaricom production Daraja base URL and production credentials. Never commit these values to GitHub.

## Safety gates

A payout must be eligible, approved, KES, positive, and have a verified payout destination before it can be atomically claimed as `processing`. The executor then submits one B2C request. If the request fails before Safaricom accepts it, the payout is held instead of automatically retrying and risking a duplicate disbursement.

Safaricom's B2C flow is asynchronous. The ResultURL records the final outcome. The conversation ID is retained separately from the M-Pesa transaction receipt so reconciliation remains possible.

## Admin flow

1. Eligible payout appears in `/admin/payouts`.
2. Admin approves or holds it.
3. An approved payout shows **Send M-Pesa** only when a verified payout destination exists.
4. Submission changes the payout to `processing`.
5. Safaricom ResultURL changes it to `paid` or `failed`.

No payout is sent merely because credentials exist. An administrator must explicitly release an approved payout.
