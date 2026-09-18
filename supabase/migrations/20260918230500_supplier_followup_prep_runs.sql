create table if not exists public.supplier_followup_prep_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('success','failed')),
  checked_count integer not null default 0,
  prepared_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create index if not exists supplier_followup_prep_runs_completed_idx
  on public.supplier_followup_prep_runs (completed_at desc);

alter table public.supplier_followup_prep_runs enable row level security;

grant select, insert on table public.supplier_followup_prep_runs to service_role;
