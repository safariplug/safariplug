create index if not exists ai_scout_runs_running_lease_idx
  on public.ai_scout_runs (poll_lease_until, claimed_at, created_at)
  where status = 'running' and queued_at is not null and provider_response_id is not null;

create or replace function public.claim_next_ai_scout_job()
returns table(id uuid, location text, category text, attempt_count integer, max_attempts integer)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('safariplug_ai_scout_claim'));

  return query
  with candidate as (
    select r.id
    from public.ai_scout_runs r
    where r.status = 'queued'
      and r.queued_at is not null
      and r.attempt_count < r.max_attempts
      and (
        select count(*)
        from public.ai_scout_runs active
        where active.status = 'running'
          and active.queued_at is not null
      ) < 2
    order by r.queued_at, r.created_at
    for update skip locked
    limit 1
  ), claimed as (
    update public.ai_scout_runs r
    set status = 'running',
        claimed_at = now(),
        started_at = now(),
        attempt_count = r.attempt_count + 1,
        completed_at = null,
        last_error = null,
        poll_lease_until = null
    from candidate c
    where r.id = c.id
    returning r.id, r.location, r.category, r.attempt_count, r.max_attempts
  )
  select * from claimed;
end;
$function$;

revoke execute on function public.claim_next_ai_scout_job() from public, anon, authenticated;
grant execute on function public.claim_next_ai_scout_job() to service_role;

create or replace function public.lease_ai_scout_running_jobs(
  p_limit integer default 2,
  p_lease_seconds integer default 50
)
returns table(
  id uuid,
  location text,
  category text,
  attempt_count integer,
  max_attempts integer,
  provider_response_id text,
  provider_status text,
  worker_stage text
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  return query
  with candidate as (
    select r.id
    from public.ai_scout_runs r
    where r.status = 'running'
      and r.queued_at is not null
      and r.provider_response_id is not null
      and (r.poll_lease_until is null or r.poll_lease_until <= now())
    order by coalesce(r.poll_lease_until, 'epoch'::timestamptz), r.claimed_at, r.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 2), 2))
  ), leased as (
    update public.ai_scout_runs r
    set poll_lease_until = now() + make_interval(secs => greatest(15, least(coalesce(p_lease_seconds, 50), 120)))
    from candidate c
    where r.id = c.id
    returning r.id, r.location, r.category, r.attempt_count, r.max_attempts,
              r.provider_response_id, r.provider_status, r.worker_stage
  )
  select * from leased;
end;
$function$;

revoke execute on function public.lease_ai_scout_running_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.lease_ai_scout_running_jobs(integer, integer) to service_role;

create or replace function public.requeue_stale_ai_scout_jobs(p_stale_minutes integer default 5)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  recovered integer;
begin
  update public.ai_scout_runs
  set status = case when attempt_count < max_attempts then 'queued' else 'failed' end,
      queued_at = case when attempt_count < max_attempts then now() else queued_at end,
      claimed_at = null,
      started_at = case when attempt_count < max_attempts then null else started_at end,
      completed_at = case when attempt_count < max_attempts then null else now() end,
      worker_stage = case when attempt_count < max_attempts then 'queued' else 'failed' end,
      provider_response_id = case when attempt_count < max_attempts then null else provider_response_id end,
      provider_status = case when attempt_count < max_attempts then null else provider_status end,
      poll_lease_until = null,
      last_error = case when attempt_count < max_attempts then null else 'Worker exceeded stale execution threshold before provider start' end,
      notes = case
        when attempt_count < max_attempts then 'AI Scout recovered a stale pre-provider claim and returned this mission to the queue.'
        else 'AI Scout exceeded the pre-provider stale threshold and exhausted its retry limit.'
      end
  where status = 'running'
    and queued_at is not null
    and provider_response_id is null
    and coalesce(claimed_at, started_at, created_at) < now() - make_interval(mins => greatest(coalesce(p_stale_minutes, 5), 5));

  get diagnostics recovered = row_count;
  return recovered;
end;
$function$;

revoke execute on function public.requeue_stale_ai_scout_jobs(integer) from public, anon, authenticated;
grant execute on function public.requeue_stale_ai_scout_jobs(integer) to service_role;
