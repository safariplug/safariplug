# CRM 2.0 Phase 8 — Partner & Supplier 360

## Goal

Make the existing Partner CRM and supplier onboarding surfaces the operational system of record for SafariPlug supply relationships without duplicating supplier data or weakening human governance.

## Existing foundation retained

SafariPlug already has:

- `safari_partners` for relationship-stage CRM records.
- `partner_invitations` for governed recruitment and outreach.
- `supplier_accounts` + `businesses` for enrolled suppliers.
- `service_profiles`, `service_offerings`, and `service_staff` for inventory and team readiness.
- `verification_cases` for independent provider verification.
- `/admin/ai-sales/partners` as the Partner Growth Command Center.
- `/admin/ai-sales/partners/[supplierId]` as the enrolled Partner 360 surface.

Phase 8 extends these records instead of introducing a competing partner master table.

## Lifecycle

`discovered → invited/contacted → signup started → onboarding → submitted → verified/reviewed → approved/live → managed`

Statuses remain sourced from the underlying systems. The UI must not manufacture a synthetic activation state that overrides onboarding or verification.

## Partner 360 operating model

The enrolled supplier view should combine:

1. Business identity and primary contact channels.
2. Recruitment/invitation history.
3. Onboarding completion and human review status.
4. Independent verification state.
5. Service inventory, pricing and booking readiness.
6. Team identity readiness, including personal-photo coverage.
7. CRM relationship context when a matching `safari_partners` record exists.
8. Governed next action for an administrator.

## Governance

AI may discover, summarize, prioritize and draft. It must not verify providers, approve onboarding, activate partners, publish inventory, send outreach without explicit approval, or make financial decisions.

Partner 360 is an administrative decision surface. Existing `/admin/suppliers` review actions remain authoritative for supplier approval and activation.

## Next increments

- Link enrolled supplier records to relationship CRM records with explicit, auditable identifiers rather than name matching where possible.
- Add CRM contacts/activities/follow-ups to enrolled Partner 360 when a stable partner/prospect link exists.
- Add booking, commission and payout rollups only from existing authoritative finance/order records; do not invent FX or revenue.
- Add document/compliance readiness when the existing supplier schema exposes authoritative document records.
