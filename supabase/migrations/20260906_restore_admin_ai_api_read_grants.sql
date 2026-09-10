-- Restore only the authenticated read grants required by admin UI pages.
-- RLS policies still restrict these rows to administrators.
GRANT SELECT ON TABLE public.ai_discovered_events TO authenticated;
GRANT SELECT ON TABLE public.ai_scout_runs TO authenticated;
