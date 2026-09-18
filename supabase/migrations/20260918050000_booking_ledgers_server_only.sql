-- Keep supplier booking metadata server-only.
-- Customer access is provided through SafariPlug server routes/pages that explicitly
-- scope queries to the authenticated user and serialize only safe public fields.

drop policy if exists transfer_booking_pricing_ledger_customer_select
  on public.transfer_booking_pricing_ledger;
drop policy if exists activity_booking_pricing_ledger_customer_select
  on public.activity_booking_pricing_ledger;

revoke all on table public.transfer_booking_pricing_ledger from anon, authenticated;
revoke all on table public.activity_booking_pricing_ledger from anon, authenticated;

comment on table public.transfer_booking_pricing_ledger is
  'Server-only governed Hotelbeds Transfers booking/payment ledger. Contains supplier and payment metadata that must not be directly exposed through the authenticated Data API.';

comment on table public.activity_booking_pricing_ledger is
  'Server-only governed Hotelbeds Activities booking/payment ledger. Contains supplier, traveler and payment metadata that must not be directly exposed through the authenticated Data API.';
