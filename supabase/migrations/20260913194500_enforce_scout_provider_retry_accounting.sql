alter table public.ai_scout_runs
  add column if not exists provider_failure_count integer not null default 0,
  add column if not exists last_provider_error text;

create index if not exists ai_scout_runs_provider_failure_idx
  on public.ai_scout_runs(status, provider_failure_count)
  where queued_at is not null;

create or replace function public.requeue_transient_ai_scout_failures()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  recovered integer;
begin
  update public.ai_scout_runs
  set status = 'queued',
      worker_stage = 'queued',
      provider_response_id = null,
      provider_status = null,
      poll_lease_until = null,
      claimed_at = null,
      started_at = null,
      completed_at = null,
      queued_at = now(),
      attempt_count = greatest(attempt_count - 1, 0),
      provider_failure_count = provider_failure_count + 1,
      last_provider_error = last_error,
      notes = 'OpenAI provider failure recovered automatically; mission returned to queue without consuming a Scout attempt.',
      last_error = null
  where status = 'failed'
    and queued_at is not null
    and last_error is not null
    and provider_failure_count < 5
    and (
      lower(last_error) like '%rate limit%'
      or lower(last_error) like '%tokens per min%'
      or lower(last_error) like '%tpm%'
      or lower(last_error) like '%429%'
      or lower(last_error) like '%temporarily unavailable%'
      or lower(last_error) like '%server overloaded%'
      or lower(last_error) like '%timeout%'
      or lower(last_error) like '%timed out%'
      or lower(last_error) like '%provider%'
      or lower(last_error) like '%background response ended with status%'
      or lower(last_error) like '%poll openai%'
    );

  get diagnostics recovered = row_count;
  return recovered;
end;
$function$;

revoke execute on function public.requeue_transient_ai_scout_failures() from public, anon, authenticated;
grant execute on function public.requeue_transient_ai_scout_failures() to service_role;

create or replace function public.enforce_ai_scout_provider_retry_accounting()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if old.status = 'running'
     and old.provider_response_id is not null
     and new.provider_response_id is null
     and new.status in ('queued','failed')
     and new.last_error is not null then

    new.provider_failure_count := coalesce(old.provider_failure_count, 0) + 1;
    new.last_provider_error := left(new.last_error, 1000);

    if new.provider_failure_count < 5 then
      new.status := 'queued';
      new.worker_stage := 'queued';
      new.attempt_count := greatest(old.attempt_count - 1, 0);
      new.claimed_at := null;
      new.started_at := null;
      new.completed_at := null;
      new.queued_at := now();
      new.poll_lease_until := null;
      new.last_error := null;
      new.notes := 'OpenAI provider failure recovered automatically; Scout attempt preserved. Provider retry ' || new.provider_failure_count || '/5.';
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

drop trigger if exists ai_scout_provider_retry_accounting on public.ai_scout_runs;
create trigger ai_scout_provider_retry_accounting
before update on public.ai_scout_runs
for each row
execute function public.enforce_ai_scout_provider_retry_accounting();