-- Avoid a SECURITY DEFINER RPC for the admin check.
-- The admin membership lookup is now constrained by an owner-only RLS policy.
GRANT SELECT ON TABLE public.admin_users TO authenticated;

CREATE POLICY admin_users_self_select
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

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

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
