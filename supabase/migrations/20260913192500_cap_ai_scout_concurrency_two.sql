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
