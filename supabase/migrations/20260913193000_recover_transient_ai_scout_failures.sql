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
      notes = 'Transient OpenAI provider failure recovered automatically; mission returned to queue without consuming the failed retry.',
      last_error = null
  where status = 'failed'
    and queued_at is not null
    and last_error is not null
    and (
      lower(last_error) like '%rate limit%'
      or lower(last_error) like '%tokens per min%'
      or lower(last_error) like '%tpm%'
      or lower(last_error) like '%429%'
      or lower(last_error) like '%temporarily unavailable%'
      or lower(last_error) like '%server overloaded%'
    );

  get diagnostics recovered = row_count;
  return recovered;
end;
$function$;

revoke execute on function public.requeue_transient_ai_scout_failures() from public, anon, authenticated;
grant execute on function public.requeue_transient_ai_scout_failures() to service_role;
