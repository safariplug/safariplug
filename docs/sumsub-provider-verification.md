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

Follow Sumsub's current production sequence:

1. Complete and test the integration in Sandbox.
2. Create a verification level under Individuals → Levels with the identity-document and live face/liveness steps SafariPlug requires.
3. Test a sandbox applicant through the SafariPlug WebSDK flow.
4. Configure a Sumsub webhook to:
   `https://www.safariplug.com/api/integrations/sumsub/webhook`
5. Configure webhook HMAC signing with SHA-256 and set the same value in `SUMSUB_WEBHOOK_SECRET`.
6. Confirm SafariPlug receives and processes a signed test webhook.
7. Move the Sumsub account/key to Production according to the account plan.
8. Create/use the production app token and secret key. Sandbox keys/settings are not assumed to be production credentials.
9. Set the production runtime variables:
   - `SUMSUB_APP_TOKEN`
   - `SUMSUB_SECRET_KEY`
   - `SUMSUB_VERIFICATION_LEVEL`
   - `SUMSUB_WEBHOOK_SECRET`
   - optional `SUMSUB_API_BASE_URL=https://api.sumsub.com`
10. Open `/admin/integrations/verification` and confirm identity + liveness shows connected with no missing configuration.
11. Run one controlled provider or specialist verification.
12. Confirm:
   - `verification_cases` is created and linked to Sumsub.
   - signed `applicantReviewed` updates the case.
   - identity and liveness evidence are accepted only after a GREEN result.
   - service-staff verification state / liveness timestamp update when applicable.
   - an unverified provider remains blocked from activation/payout.
   - a verified provider still requires a verified M-Pesa payout destination and the remaining SafariPlug readiness gates.

Sumsub notes that production settings are not automatically copied from Sandbox, so production webhooks and production API credentials must be configured explicitly.
