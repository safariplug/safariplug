create unique index if not exists food_order_payment_mpesa_provider_reference_unique
on public.food_order_payment_idempotency (provider, provider_reference)
where provider = 'mpesa' and provider_reference is not null;
