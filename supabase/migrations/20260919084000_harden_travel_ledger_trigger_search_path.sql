-- Pin trigger-function search paths for travel booking ledgers.
alter function public.set_transfer_booking_pricing_ledger_updated_at() set search_path = '';
alter function public.set_activity_booking_pricing_ledger_updated_at() set search_path = '';
