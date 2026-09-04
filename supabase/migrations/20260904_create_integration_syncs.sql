create table if not exists public.integration_syncs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  safariplug_event_id uuid not null references public.events(id) on delete cascade,
  external_id text,
  sync_status text not null default 'pending'
    check (sync_status = any (array[
      'pending'::text,
      'synced'::text,
      'error'::text,
      'skipped'::text,
      'not_configured'::text
    ])),
  last_synced_at timestamptz,
  last_error text,
  last_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, safariplug_event_id)
);

create index if not exists integration_syncs_provider_status_idx
  on public.integration_syncs (provider, sync_status);

create index if not exists integration_syncs_event_idx
  on public.integration_syncs (safariplug_event_id);

alter table public.integration_syncs enable row level security;

comment on table public.integration_syncs is
  'Tracks SafariPlug event sync state to external partners. No public policies; server uses service role after admin auth.';
