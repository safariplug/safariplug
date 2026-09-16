-- Keep repository migration history aligned with the production security hardening.
-- This trigger function is internal infrastructure and must not be executable by app users.

revoke execute on function public.enforce_ai_scout_provider_retry_accounting() from public, anon, authenticated;
grant execute on function public.enforce_ai_scout_provider_retry_accounting() to service_role;
