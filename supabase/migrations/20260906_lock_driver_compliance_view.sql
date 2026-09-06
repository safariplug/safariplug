-- Keep sensitive driver compliance data out of the public Data API.
-- The view contains license/insurance/registration identifiers and expiry data.
REVOKE ALL ON TABLE public.driver_compliance_overview FROM anon, authenticated;
GRANT SELECT ON TABLE public.driver_compliance_overview TO service_role;
