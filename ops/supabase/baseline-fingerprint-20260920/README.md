# Supabase production baseline fingerprint — 2026-09-20

This directory is a **read-only catalog fingerprint** of SafariPlug production Supabase project `safcizxahjqassrwhrup`.

It exists to support issue #172 migration-history normalization without replaying legacy migrations or mutating production history.

## Contents

- `columns.json` — public table/view column signatures and defaults
- `constraints-indexes.json` — public constraints and index definitions
- `policies-triggers.json` — public RLS policies and non-internal trigger definitions
- `functions.json` — public function signatures, security-definer flags, return types, and definitions
- `api-grants.json` — table grants for `anon`, `authenticated`, and `service_role`
- `migrations.json` — production migration history returned by Supabase
- `schema-meta.json` — relation/RLS metadata, views, sequences, enums, extensions, role memberships, and default privileges

The snapshot supplements the owner-only CLI workflow in
`.github/workflows/supabase-baseline-audit.yml`. The CLI workflow remains the authority for a full `supabase db dump --linked` and role dump.

## Safety

This snapshot was collected with read-only catalog queries and Supabase migration listing. It did **not** run:

- `supabase db push`
- `supabase db pull`
- `supabase migration repair`
- remote `db reset`
- DDL or DML against application tables

Do not normalize production migration history until a clean database rebuilt from the proposed canonical baseline compares cleanly with this fingerprint **and** the CLI schema dump.

## Comparison

Run:

```bash
node scripts/compare-supabase-baseline.mjs <expected-dir> <actual-dir>
```

Both directories must contain the seven JSON files listed above. Comparison ignores only `captured_at_utc`; every captured schema/migration value is otherwise compared exactly.
