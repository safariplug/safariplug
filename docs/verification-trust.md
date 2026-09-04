# SafariPlug verification & trust foundation

Auditable verification for drivers and future providers.
**No identity, liveness, license, insurance, or background verification is claimed until a real provider or documented human review establishes it.**

## Data model

Additive migration `supabase/migrations/20260907_verification_trust.sql` (**not applied by this commit**).

| Table | Purpose |
|---|---|
| `verification_cases` | Subject (driver/provider/vehicle), status, level, reviewer, expiry |
| `verification_evidence` | Opaque `storage_ref` / `external_ref` only. No passport or national ID columns |
| `verification_events` | Append-only audit trail |

Driver tables are unchanged. `driver_forbid_verified()` is **replaced** (not simply deleted) with `driver_require_approved_verification()`: `verification_state = verified` is still impossible unless an **approved, non-expired** case exists for that driver.

Controlled RPC: `apply_driver_verification_state(driver_id, state, case_id)` (service_role only).

## Trust states

`unverified | verification_pending | verified | verification_expired | verification_revoked | rejected`

Bookable requires `service_status = active` **and** trust `verified`, plus existing vehicle/capacity/availability/area/capability/conflict checks.

Preferred is ranking only.

## Workflow

```
create case \u2192 submit evidence \u2192 in_review \u2192 approve | reject
approve \u2192 driver verified (controlled function)
revoke / expire \u2192 not bookable
```

Reject and revoke require a reason. Approve requires required evidence for the level.

### Required evidence

- `basic`: `provider_attestation`
- `identity`: `identity` (+ `liveness` only if a live liveness adapter exists)
- `enhanced`: `identity`, `license` (+ liveness if live)

Human review is **not** a KYC provider. It records that an admin reviewed opaque evidence references.

## Security

- RLS on; **no** anon/authenticated grants
- No `/api/v1` verification routes
- No public driver directory
- Admin routes only: `/api/admin/verification*`
- Safe evidence view omits `storage_ref`
- Public trust signal only when genuinely `verified`

## Admin

`/admin/integrations/verification`

Actions: start review, approve, reject (reason), revoke (reason). Every decision writes a `verification_events` row.

## Future providers

Registry keys: identity_provider, liveness_provider, document_provider, background_provider.

A class is not live. Without a contract, adapters return `verification_not_configured`.

## Explicitly NOT implemented

- Real KYC / government ID / passport verification
- Liveness or selfie matching
- License, insurance, or vehicle document validation
- Background / sanctions screening
- Public document upload / public signed URLs
- Fake verified identities
