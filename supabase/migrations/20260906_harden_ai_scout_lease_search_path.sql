CREATE OR REPLACE FUNCTION public.try_acquire_ai_scout_lease(p_owner text, p_lease_seconds integer DEFAULT 900)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
begin
  update public.ai_scout_locks
  set locked_until = now() + make_interval(secs => greatest(p_lease_seconds, 60)),
      locked_by = p_owner,
      updated_at = now()
  where lock_name = 'global'
    and (locked_until is null or locked_until < now());

  return found;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_ai_scout_lease(p_owner text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
begin
  update public.ai_scout_locks
  set locked_until = null,
      locked_by = null,
      updated_at = now()
  where lock_name = 'global'
    and locked_by = p_owner;

  return found;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.try_acquire_ai_scout_lease(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_ai_scout_lease(text, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.release_ai_scout_lease(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_ai_scout_lease(text) TO service_role;
