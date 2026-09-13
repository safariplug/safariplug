create or replace function public.claim_next_ai_scout_job()
returns table(id uuid, location text, category text, attempt_count integer, max_attempts integer)
language plpgsql
security definer
set search_path to ''
as $function$
begin
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
      ) < 3
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
        last_error = null
    from candidate c
    where r.id = c.id
    returning r.id, r.location, r.category, r.attempt_count, r.max_attempts
  )
  select * from claimed;
end;
$function$;

revoke execute on function public.claim_next_ai_scout_job() from public, anon, authenticated;
grant execute on function public.claim_next_ai_scout_job() to service_role;

create or replace function public.requeue_stale_ai_scout_jobs(p_stale_minutes integer default 10)
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
      last_error = case when attempt_count < max_attempts then null else 'Worker exceeded stale execution threshold' end,
      notes = case
        when attempt_count < max_attempts then 'AI Scout worker recovered a stale attempt and returned this mission to the queue.'
        else 'AI Scout worker exceeded the stale threshold and exhausted its retry limit.'
      end
  where status = 'running'
    and queued_at is not null
    and provider_response_id is null
    and coalesce(claimed_at, started_at, created_at) < now() - make_interval(mins => greatest(p_stale_minutes, 1));

  get diagnostics recovered = row_count;
  return recovered;
end;
$function$;

revoke execute on function public.requeue_stale_ai_scout_jobs(integer) from public, anon, authenticated;
grant execute on function public.requeue_stale_ai_scout_jobs(integer) to service_role;
