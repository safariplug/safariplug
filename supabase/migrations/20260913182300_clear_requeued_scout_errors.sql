CREATE OR REPLACE FUNCTION public.requeue_stale_ai_scout_jobs(p_stale_minutes integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recovered integer;
BEGIN
  UPDATE public.ai_scout_runs
  SET status = CASE WHEN attempt_count < max_attempts THEN 'queued' ELSE 'failed' END,
      queued_at = CASE WHEN attempt_count < max_attempts THEN now() ELSE queued_at END,
      claimed_at = NULL,
      started_at = CASE WHEN attempt_count < max_attempts THEN NULL ELSE started_at END,
      completed_at = CASE WHEN attempt_count < max_attempts THEN NULL ELSE now() END,
      worker_stage = CASE WHEN attempt_count < max_attempts THEN 'queued' ELSE 'failed' END,
      provider_response_id = CASE WHEN attempt_count < max_attempts THEN NULL ELSE provider_response_id END,
      provider_status = CASE WHEN attempt_count < max_attempts THEN NULL ELSE provider_status END,
      last_error = CASE
        WHEN attempt_count < max_attempts THEN NULL
        ELSE 'Worker exceeded stale execution threshold'
      END,
      notes = CASE
        WHEN attempt_count < max_attempts THEN 'AI Scout worker recovered a stale attempt and returned this mission to the queue.'
        ELSE 'AI Scout worker exceeded the stale threshold and exhausted its retry limit.'
      END
  WHERE status = 'running'
    AND queued_at IS NOT NULL
    AND coalesce(claimed_at, started_at, created_at) < now() - make_interval(mins => greatest(p_stale_minutes, 1));

  GET DIAGNOSTICS recovered = ROW_COUNT;
  RETURN recovered;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.requeue_stale_ai_scout_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_stale_ai_scout_jobs(integer) TO service_role;
