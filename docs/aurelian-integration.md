# SafariPlug ↔ Aurelian integration foundation

SafariPlug is the destination-discovery source of truth.
Aurelian Hospitality is the intended operations/hospitality partner.

## What already existed

Inbound pull (unchanged):

```
GET /api/integrations/aurelian/events
Header: x-api-key: SAFARIPLUG_AURELIAN_API_KEY
```

Returns approved `events` as `experiences`. This is the only documented
Aurelian contract in the repository.

There is **no outbound Aurelian API URL or path** in this codebase.
This foundation does not invent one and does not claim live push sync.

## Architecture

```
Approved SafariPlug events
        ↓
mapEventToAurelianExperience()
        ↓
integration_syncs (provider = aurelian)
        ↓
adapter.syncExperience()  ← no-op until contract exists
        ↓
Aurelian (future)
```

## Environment

| Variable | Role |
|---|---|
| `SAFARIPLUG_AURELIAN_API_KEY` | Existing inbound pull secret. Server-only. Never `NEXT_PUBLIC_`. |
| `AURELIAN_API_BASE_URL` | Required for future outbound calls. **Not invented.** Unset today. |

Outbound paths in `lib/integrations/aurelian/config.ts` are `null`
(`AURELIAN_SYNC_EXPERIENCE_PATH`, `AURELIAN_GET_EXPERIENCE_PATH`,
`AURELIAN_HEALTH_PATH`) until Aurelian documents them.

## Admin

- Page: `/admin/integrations` (`is_admin()` / existing admin proxy)
- POST `/api/admin/integrations/aurelian/sync`
- Server action `runAurelianSync`

These load approved inventory, map it, and write `integration_syncs`
rows with `sync_status = not_configured`. They do not call a fake URL.

## Database

Migration `supabase/migrations/20260904_create_integration_syncs.sql`

Unique `(provider, safariplug_event_id)`. RLS enabled, no public policies.
