-- Remove only indexes that are fully covered by wider indexes with
-- the same leftmost key sequence. Primary, unique, constraint-backed,
-- partial, and expression indexes are intentionally excluded.

drop index if exists public.service_provider_payouts_status_idx;
drop index if exists public.idx_food_delivery_assignments_driver;
drop index if exists public.verification_evidence_case_idx;
