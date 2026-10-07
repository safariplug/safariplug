alter table public.traveler_reviews
  add column if not exists product_ref text null,
  add column if not exists product_name text null,
  add column if not exists provider text null;

create index if not exists traveler_reviews_product_identity_idx
  on public.traveler_reviews (product_type, provider, product_ref, moderation_status)
  where product_ref is not null;

create table if not exists public.traveler_review_summaries (
  id uuid primary key default gen_random_uuid(),
  product_type text not null,
  provider text not null default '',
  product_ref text not null default '',
  business_id uuid null references public.businesses(id) on delete cascade,
  review_count integer not null default 0,
  source_hash text not null,
  summary text not null,
  generated_at timestamptz not null default now(),
  unique (product_type, provider, product_ref, business_id)
);

alter table public.traveler_review_summaries enable row level security;
drop policy if exists "traveler_review_summaries_no_direct_access" on public.traveler_review_summaries;
create policy "traveler_review_summaries_no_direct_access" on public.traveler_review_summaries for all using (false) with check (false);
