-- Only one durable queue job may execute at a time. Historical execution rows
-- have queued_at = null and are intentionally excluded from retry recovery.

CREATE OR REPLACE FUNCTION public.claim_next_ai_scout_job()
RETURNS TABLE (
  id uuid,
  location text,
  category text,
  attempt_count integer,
  max_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT r.id
    FROM public.ai_scout_runs r
    WHERE r.status = 'queued'
      AND r.queued_at IS NOT NULL
      AND r.attempt_count < r.max_attempts
      AND NOT EXISTS (
        SELECT 1
        FROM public.ai_scout_runs active
        WHERE active.status = 'running'
          AND active.queued_at IS NOT NULL
      )
    ORDER BY r.queued_at, r.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  ), claimed AS (
    UPDATE public.ai_scout_runs r
    SET status = 'running',
        claimed_at = now(),
        started_at = now(),
        attempt_count = r.attempt_count + 1,
        completed_at = NULL,
        last_error = NULL
    FROM candidate c
    WHERE r.id = c.id
    RETURNING r.id, r.location, r.category, r.attempt_count, r.max_attempts
  )
  SELECT * FROM claimed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_next_ai_scout_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_ai_scout_job() TO service_role;

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
      completed_at = CASE WHEN attempt_count < max_attempts THEN NULL ELSE now() END,
      last_error = 'Worker exceeded stale execution threshold',
      notes = CASE
        WHEN attempt_count < max_attempts THEN 'AI Scout worker exceeded the stale threshold and was returned to the queue for retry.'
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
