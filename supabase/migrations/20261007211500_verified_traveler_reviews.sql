create table if not exists public.traveler_reviews (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references auth.users(id) on delete cascade,
  product_type text not null check (product_type in ('service','hotel','activity','transfer','event','restaurant')),
  source_id uuid not null,
  business_id uuid null references public.businesses(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  dimensions jsonb not null default '{}'::jsonb,
  title text null,
  body text null,
  verified_booking boolean not null default true,
  moderation_status text not null default 'approved' check (moderation_status in ('pending','approved','rejected','reported')),
  supplier_response text null,
  supplier_responded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (traveler_id, product_type, source_id)
);

create index if not exists traveler_reviews_business_idx
  on public.traveler_reviews (business_id, moderation_status, created_at desc);

create index if not exists traveler_reviews_source_idx
  on public.traveler_reviews (product_type, source_id);

alter table public.traveler_reviews enable row level security;

drop policy if exists "traveler_reviews_no_direct_access" on public.traveler_reviews;
create policy "traveler_reviews_no_direct_access"
on public.traveler_reviews
for all
using (false)
with check (false);

create or replace function public.set_traveler_reviews_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists traveler_reviews_updated_at on public.traveler_reviews;
create trigger traveler_reviews_updated_at
before update on public.traveler_reviews
for each row execute function public.set_traveler_reviews_updated_at();
