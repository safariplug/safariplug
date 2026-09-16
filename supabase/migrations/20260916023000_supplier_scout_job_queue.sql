create table if not exists public.supplier_scout_jobs (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  category text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  queued_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  provider_response_id text,
  provider_status text,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  qualified_count integer not null default 0,
  contact_ready_count integer not null default 0,
  needs_research_count integer not null default 0,
  inserted_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists supplier_scout_jobs_queue_idx on public.supplier_scout_jobs(status, queued_at);
alter table public.supplier_scout_jobs enable row level security;

create or replace function public.claim_next_supplier_scout_job()
returns setof public.supplier_scout_jobs
language plpgsql security definer set search_path=''
as $$
begin
  return query
  with candidate as (
    select j.id from public.supplier_scout_jobs j
    where j.status='queued' and j.attempt_count < j.max_attempts
    order by j.queued_at, j.created_at
    for update skip locked limit 1
  )
  update public.supplier_scout_jobs j
  set status='running', claimed_at=now(), attempt_count=j.attempt_count+1, last_error=null
  from candidate c where j.id=c.id returning j.*;
end; $$;

revoke all on function public.claim_next_supplier_scout_job() from public, anon, authenticated;
grant execute on function public.claim_next_supplier_scout_job() to service_role;
revoke all on table public.supplier_scout_jobs from anon, authenticated;
grant all on table public.supplier_scout_jobs to service_role;
