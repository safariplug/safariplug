-- Harden restaurant refund records.
-- All current application access uses the server-side service role, and the
-- atomic refund finalizer is executable only by service_role.
-- No anon/authenticated policies are intentionally created.

alter table public.food_order_refunds enable row level security;
