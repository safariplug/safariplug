# Supabase migration history policy

Production is the migration-history authority for SafariPlug until the legacy history is normalized.

## Current legacy state

A full comparison on 2026-09-20 found:

- 153 SQL files in `supabase/migrations`
- 206 rows in production `supabase_migrations.schema_migrations`
- 135 local versions absent from production history
- 188 production versions absent from the local migration directory
- several legacy local files share the same version prefix
- production's oldest `remote_schema` history row has no stored SQL statements

The previously identified 23 September 17-19 local gaps are real, and their live schema effects were verified. They are only a subset of the historical drift. Repairing those 23 versions alone would not make `supabase migration list` consistent, so the automated 23-version repair workflow was removed before it changed production.

## Safety rule

Do not run `supabase db push` or bulk `supabase migration repair` against production from the current legacy migration directory.

Do not delete or rename a legacy migration simply to make history appear aligned.

A proper normalization must first create a canonical production baseline/history using an authenticated Supabase CLI workflow, then verify that a fresh database built from the normalized migration set matches production before the legacy set is retired.

## Forward rule

The existing files listed in `legacy-migration-files.txt` are grandfathered history. Every migration added after this checkpoint must:

1. use a unique 14-digit UTC timestamp,
2. use a snake_case migration name,
3. have a version later than `20260920014336`, and
4. never reuse a legacy or current migration version.

Use `supabase migration new <name>` when working through the Supabase CLI. CI runs `npm run validate:migrations` to stop new history drift.

## Read-only baseline audit

A manual owner-only workflow now exists at `.github/workflows/supabase-baseline-audit.yml`.

It intentionally runs from an isolated temporary Supabase directory and uses only read-oriented operations against production:

- `supabase migration list --linked`
- `supabase db dump --linked`
- `supabase db dump --linked --role-only`
- `supabase gen types --lang typescript --linked`

It does **not** run `db pull`, `db push`, `migration repair`, or remote `db reset`.

The workflow requires `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` GitHub Actions secrets. Those secrets were not present during the earlier repair attempt, so this workflow is prepared but should only be dispatched after the credentials are intentionally configured.

When run, it keeps the production schema dump, role dump, migration-list output, generated types, manifest, and SHA-256 checksums as a 30-day private GitHub Actions artifact. The artifact is evidence for normalization review; it is not automatically committed to the repository.

A live read-only catalog inventory captured on 2026-09-20 is stored in `production-schema-inventory-20260920.json`. At that checkpoint production had 97 public tables, 84 public functions, 88 policies, 411 indexes, 47 non-internal triggers, 470 constraints, and one public view.

## Production status

The production schema remains healthy and was not changed by the aborted repair workflow. The legacy-history problem is bookkeeping/deployment-history drift, not evidence that the verified production schema repairs are missing.
