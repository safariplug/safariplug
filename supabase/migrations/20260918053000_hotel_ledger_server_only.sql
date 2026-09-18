-- Keep hotel supplier/payment metadata server-only.
-- Customer hotel checkout state is exposed only through SafariPlug server routes
-- that scope by authenticated user and serialize safe public fields.

drop policy if exists "customers can view their hotel pricing ledger"
  on public.hotel_booking_pricing_ledger;
drop policy if exists hotel_booking_pricing_ledger_customer_select
  on public.hotel_booking_pricing_ledger;

revoke all on table public.hotel_booking_pricing_ledger from anon, authenticated;

comment on table public.hotel_booking_pricing_ledger is
  'Server-only governed hotel booking/payment ledger. Contains supplier booking tokens, guest data and payment/reconciliation metadata that must not be directly exposed through the authenticated Data API.';
