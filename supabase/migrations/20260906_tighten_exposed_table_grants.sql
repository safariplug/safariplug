-- Remove client-role privileges that are not backed by an intentional public policy.
REVOKE ALL ON TABLE public.ai_discovered_events, public.ai_scans, public.ai_scout_runs, public.safari_partners FROM anon, authenticated;
REVOKE ALL ON TABLE public.saved_events FROM anon;
REVOKE ALL ON TABLE public.businesses FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.cities FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.journal_articles FROM anon, authenticated;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.inventory_kinds FROM anon, authenticated;
REVOKE ALL ON TABLE public.offerings FROM anon;
REVOKE ALL ON TABLE public.providers FROM anon;
