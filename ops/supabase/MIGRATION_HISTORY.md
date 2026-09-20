# Supabase migration history policy

SafariPlug now has a canonical production-schema baseline candidate derived from the verified read-only production capture in GitHub Actions run 35485349948.

## Canonical baseline candidate

- Active baseline migration: `20260920030845_production_baseline.sql`
- Baseline version: `20260920030845`
- Source artifact: `supabase-production-baseline-35485349948`
- Source artifact SHA-256 digest: `61f48ee100968e858704971b3f29b33c72f0a2d62d66c1873df59d69ffe1dbc6`
- Fresh-database validation run: `35485457513`
- Production was not modified while creating or validating this baseline.

The former 153 SQL migration files have been retired from the active `supabase/migrations` chain. Their filenames remain recorded in `ops/supabase/legacy-migration-files-retired-20260920.txt`, and their complete contents remain preserved in Git history.

## Safety rule

Do not run `supabase db push`, `supabase migration repair`, or `supabase db reset --linked` against production while this normalization PR is under validation.

Production migration history still contains the pre-normalization history. Schema reproducibility must be fully verified from the canonical baseline before any supported history-only repair is considered.

## Forward rule

Every active migration must:
1. use a unique 14-digit UTC timestamp,
2. use a snake_case migration name,
3. have a version later than the canonical baseline version unless it is the baseline itself, and
4. never reactivate a retired legacy filename.

Create future migration files with `supabase migration new <name>`.

## Verification gates

Before production migration history is normalized:
1. `npm run validate:migrations` must pass.
2. A fresh local `supabase db reset` must succeed from the canonical migration set.
3. Public-schema object counts must match the verified production checkpoint.
4. Locally generated TypeScript database types must match the production capture.
5. CI/Quality must pass.
6. Production history changes, if still needed, must use supported Supabase CLI history operations only; never direct SQL edits to `supabase_migrations.schema_migrations`.

## Verified production checkpoint

The production checkpoint captured on 2026-09-20 contains:
- 97 public tables
- 84 public functions
- 88 policies
- 411 indexes
- 47 non-internal triggers
- 470 constraints
- 1 public view
