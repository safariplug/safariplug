# CRM 2.0 Phase 7 — Governed Outreach Context

Phase 7 connects Organization 360 to the existing partner invitation workflow without creating a second outreach system.

## Data linkage

`partner_invitations` gains nullable references to:

- `ai_sales_prospects` through `prospect_id`
- `safari_partners` through `partner_id`
- `crm_contacts` through `contact_id`

The links are nullable so historical invitations remain valid. `ON DELETE SET NULL` preserves invitation history if a linked CRM record is removed.

## Human governance

The existing control model remains mandatory:

1. Human selects or confirms the outreach target.
2. AI may draft a message from known CRM facts.
3. Human reviews and edits the exact message.
4. Human explicitly approves it.
5. A separate explicit send action is required.

AI must not verify contacts, approve its own message, send automatically, invent contact names, achievements, relationships, rates, booking volumes, earnings, verification, or guarantees.

## Context resolution

When Organization 360 launches outreach, SafariPlug resolves the prospect server-side. It prefers the prospect's primary CRM contact and falls back to the oldest contact if no primary exists. Missing contact information remains missing; it is not fabricated.

## Deployment

Schema changes are deployed through Supabase migrations. Application deployment authority is Hostinger. Vercel is not part of the SafariPlug deployment path.
