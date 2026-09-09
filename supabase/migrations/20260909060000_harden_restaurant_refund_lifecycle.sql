alter table public.food_order_refunds drop constraint if exists food_order_refunds_status_check;
alter table public.food_order_refunds add constraint food_order_refunds_status_check check (status = any (array['pending','processing','succeeded','failed']));
create index if not exists food_order_refunds_provider_reference_idx on public.food_order_refunds(provider_reference) where provider_reference is not null;
