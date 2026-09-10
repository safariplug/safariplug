create table if not exists public.food_order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.food_orders(id) on delete cascade,
  provider text not null,
  amount numeric not null check (amount > 0),
  currency text not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status = any (array['pending','processing','succeeded','failed'])),
  provider_reference text,
  refund_reference text,
  requested_by uuid,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists food_order_refunds_one_active
  on public.food_order_refunds(order_id)
  where status in ('pending','processing');

create index if not exists food_order_refunds_order_idx
  on public.food_order_refunds(order_id, created_at desc);

create index if not exists food_order_refunds_provider_reference_idx
  on public.food_order_refunds(provider_reference)
  where provider_reference is not null;
