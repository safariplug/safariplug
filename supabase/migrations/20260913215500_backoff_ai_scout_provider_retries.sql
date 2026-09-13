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
      and r.queued_at <= now()
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

create or replace function public.enforce_ai_scout_provider_retry_accounting()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  retry_delay interval;
begin
  if old.status = 'running'
     and old.provider_response_id is not null
     and new.provider_response_id is null
     and new.status in ('queued','failed')
     and new.last_error is not null then

    new.provider_failure_count := coalesce(old.provider_failure_count, 0) + 1;
    new.last_provider_error := left(new.last_error, 1000);

    if new.provider_failure_count < 5 then
      retry_delay := case new.provider_failure_count
        when 1 then interval '1 minute'
        when 2 then interval '3 minutes'
        when 3 then interval '7 minutes'
        else interval '15 minutes'
      end;

      new.status := 'queued';
      new.worker_stage := 'queued';
      new.attempt_count := greatest(old.attempt_count - 1, 0);
      new.claimed_at := null;
      new.started_at := null;
      new.completed_at := null;
      new.queued_at := now() + retry_delay;
      new.poll_lease_until := null;
      new.last_error := null;
      new.notes := 'OpenAI provider failure recovered automatically; Scout attempt preserved. Provider retry '
        || new.provider_failure_count || '/5 scheduled after backoff.';
    else
      new.status := 'failed';
      new.worker_stage := 'failed';
      new.completed_at := coalesce(new.completed_at, now());
      new.poll_lease_until := null;
      new.notes := 'OpenAI provider failed repeatedly; provider retry limit 5/5 exhausted.';
    end if;
  end if;

  return new;
end;
$function$;

create index if not exists ai_scout_runs_queue_ready_idx
  on public.ai_scout_runs (status, queued_at, created_at)
  where status = 'queued';

revoke execute on function public.claim_next_ai_scout_job() from public, anon, authenticated;
grant execute on function public.claim_next_ai_scout_job() to service_role;
