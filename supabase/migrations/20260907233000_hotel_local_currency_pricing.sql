alter table public.hotel_booking_pricing_ledger
  add column if not exists supplier_currency text,
  add column if not exists customer_currency text,
  add column if not exists exchange_rate numeric(20,10),
  add column if not exists customer_retail_amount numeric(14,2);

update public.hotel_booking_pricing_ledger
set supplier_currency = coalesce(supplier_currency, currency),
    customer_currency = coalesce(customer_currency, currency),
    customer_retail_amount = coalesce(customer_retail_amount, retail_amount)
where supplier_currency is null
   or customer_currency is null
   or customer_retail_amount is null;
