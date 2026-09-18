create table if not exists public.travel_refund_reviews (
  id uuid primary key default gen_random_uuid(),
  product text not null check (product in ('hotel','transfer','activity')),
  ledger_id uuid not null,
  provider text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','in_review','resolved')),
  resolution text check (resolution is null or resolution in ('refund_required','no_refund_due','refunded_externally')),
  notes text,
  assigned_to uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product, ledger_id)
);

create index if not exists travel_refund_reviews_status_idx
  on public.travel_refund_reviews(status, created_at desc);

alter table public.travel_refund_reviews enable row level security;
revoke all on table public.travel_refund_reviews from anon, authenticated;

comment on table public.travel_refund_reviews is
  'Server-only finance review workflow for travel bookings that may require a customer refund. This table records staff review state only and does not itself move money or alter payment truth.';
