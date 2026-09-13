-- Keep repository migrations aligned with the live SafariPlug admin authorization model.
-- Admin access is stored in public.admin_users and checked with public.is_admin().
-- The function must remain SECURITY INVOKER so Row Level Security applies to the caller.

GRANT SELECT ON TABLE public.admin_users TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
