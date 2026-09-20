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

A payout must be eligible, approved, KES, positive, and have a verified payout destination before it can be atomically claimed as `processing`. The executor then submits one B2C request. A confirmed pre-submission failure or explicit provider rejection can be held for review. If submission outcome is uncertain (for example a network failure after the B2C request may have reached Safaricom), the payout remains `processing`, is marked for reconciliation, and must not be retried.

Safaricom's B2C flow is asynchronous. The ResultURL records the final outcome. The conversation ID is retained separately from the M-Pesa transaction receipt so reconciliation remains possible. If Safaricom accepted a request but SafariPlug cannot persist the conversation reference, the payout remains locked in `processing`; operators must reconcile it before any further money movement.

## Admin flow

1. Eligible payout appears in `/admin/payouts`.
2. Admin approves or holds it.
3. An approved payout shows **Send M-Pesa** only when a verified payout destination exists.
4. Submission changes the payout to `processing`.
5. Safaricom ResultURL changes it to `paid` or `failed`.

No payout is sent merely because credentials exist. An administrator must explicitly release an approved payout.


## Result callback persistence

The B2C result callback is acknowledged as successfully processed only after SafariPlug can match the payout and persist the final state, or when the payout is already in an idempotent terminal state. Unmatched callbacks and database persistence failures are not silently acknowledged as successful.

Callback processing preserves the original B2C request evidence in payout metadata and adds the provider result alongside it for reconciliation.
