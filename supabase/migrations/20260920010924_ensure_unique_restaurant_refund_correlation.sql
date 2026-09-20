create unique index if not exists food_order_refunds_mpesa_provider_reference_unique
on public.food_order_refunds (provider, provider_reference)
where provider = 'mpesa' and provider_reference is not null;

create unique index if not exists food_order_refunds_mpesa_refund_reference_unique
on public.food_order_refunds (provider, refund_reference)
where provider = 'mpesa' and refund_reference is not null;
