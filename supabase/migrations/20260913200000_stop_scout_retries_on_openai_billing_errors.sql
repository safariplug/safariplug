create or replace function public.enforce_ai_scout_provider_retry_accounting()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_error text;
  v_delay interval;
begin
  if old.status = 'running'
     and old.provider_response_id is not null
     and new.provider_response_id is null
     and new.status in ('queued','failed')
     and new.last_error is not null then

    v_error := lower(new.last_error);
    new.last_provider_error := left(new.last_error, 1000);

    if v_error like '%no credits remaining%'
       or v_error like '%insufficient_quota%'
       or v_error like '%billing%'
       or v_error like '%add credits%' then
      new.provider_failure_count := coalesce(old.provider_failure_count, 0) + 1;
      new.status := 'failed';
      new.worker_stage := 'failed';
      new.attempt_count := greatest(old.attempt_count - 1, 0);
      new.claimed_at := null;
      new.started_at := null;
      new.completed_at := now();
      new.queued_at := old.queued_at;
      new.poll_lease_until := null;
      new.last_error := 'OpenAI API credits exhausted. Add API credits before retrying this Scout mission.';
      new.notes := 'Scout paused by non-retryable OpenAI billing/credit error. Mission attempt preserved; action required before retry.';
      return new;
    end if;

    new.provider_failure_count := coalesce(old.provider_failure_count, 0) + 1;

    if new.provider_failure_count < 5 then
      v_delay := case new.provider_failure_count
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
      new.queued_at := now() + v_delay;
      new.poll_lease_until := null;
      new.last_error := null;
      new.notes := 'OpenAI provider failure recovered automatically; Scout attempt preserved. Provider retry ' || new.provider_failure_count || '/5 scheduled after backoff.';
    else
      new.status := 'failed';
      new.worker_stage := 'failed';
      new.attempt_count := greatest(old.attempt_count - 1, 0);
      new.completed_at := coalesce(new.completed_at, now());
      new.poll_lease_until := null;
      new.notes := 'OpenAI provider failed repeatedly; provider retry limit 5/5 exhausted. Mission attempt preserved.';
    end if;
  end if;

  return new;
end;
$function$;
