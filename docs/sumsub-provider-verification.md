# SafariPlug provider verification — Sumsub

SafariPlug now has a provider-neutral verification adapter with a Sumsub implementation for enhanced provider identity + live liveness.

## Server-side configuration

Configure these secrets in the production runtime only; never commit them to GitHub or expose them to the browser:

```text
SUMSUB_APP_TOKEN=
SUMSUB_SECRET_KEY=
SUMSUB_VERIFICATION_LEVEL=
SUMSUB_WEBHOOK_SECRET=
SUMSUB_API_BASE_URL=https://api.sumsub.com
```

`SUMSUB_VERIFICATION_LEVEL` must exactly match an enabled Sumsub production verification level configured for identity + liveness. Sumsub level names are case-sensitive.

## Webhook

Configure a Sumsub HTTP webhook to:

`https://www.safariplug.com/api/integrations/sumsub/webhook`

Use HTTPS and configure HMAC SHA-256. The webhook secret must match `SUMSUB_WEBHOOK_SECRET`.

The handler validates `X-Payload-Digest` against the raw request body and the advertised digest algorithm, then maps final `applicantReviewed` results into the SafariPlug verification case. Sumsub documents HMAC webhook verification and recommends webhooks as the primary result channel.

## Provider flow

1. Provider signs into SafariPlug.
2. Provider opens `/business/verification`.
3. SafariPlug creates or reuses an enhanced provider verification case.
4. SafariPlug creates a Sumsub applicant bound to the opaque `safariplug:<caseId>` external user ID.
5. SafariPlug generates a short-lived Sumsub WebSDK link.
6. Provider completes the configured identity + live-liveness flow on Sumsub.
7. Sumsub calls the signed webhook.
8. A `GREEN` final result marks the case approved and records accepted identity + liveness evidence.
9. The database payout trigger blocks provider payouts unless the approved verification and accepted identity/liveness evidence are present.

## Important

Do not manually set `verification_cases.status='approved'` for a provider as a substitute for liveness. Do not mark liveness evidence accepted from the browser. The provider must complete the external verification flow and SafariPlug must receive the signed result.

Sumsub supports WebSDK access tokens and external WebSDK links. The implementation uses a short-lived external WebSDK link so SafariPlug does not need to ship provider credentials to the browser.

## Go-live checklist

- Create Sumsub production app token with only required permissions.
- Create/enable the production enhanced verification level containing identity and liveness.
- Set all five server-side environment variables.
- Configure the HTTPS webhook and SHA-256 secret.
- Test a sandbox applicant before production activation.
- Verify the webhook changes a test case only after a valid signed event.
- Verify a non-verified provider remains blocked by the payout database trigger.
- Verify an approved provider still needs a verified M-Pesa payout destination and compliant documents before payout execution.
