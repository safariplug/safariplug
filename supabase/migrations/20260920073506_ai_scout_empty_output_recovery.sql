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
      or lower(last_error) like '%completed without output text%'
      or lower(last_error) like '%poll openai%'
    );

  get diagnostics recovered = row_count;
  return recovered;
end;
$function$;

revoke all on function public.requeue_transient_ai_scout_failures() from public;
grant execute on function public.requeue_transient_ai_scout_failures() to service_role;
