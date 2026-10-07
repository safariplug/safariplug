
create table if not exists public.traveler_review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.traveler_reviews(id) on delete cascade,
  traveler_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  content_type text not null,
  file_size bigint not null check (file_size > 0),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists traveler_review_media_review_idx on public.traveler_review_media (review_id, moderation_status, created_at);

create table if not exists public.traveler_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.traveler_reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text null,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  unique (review_id, reporter_id)
);

create index if not exists traveler_review_reports_status_idx on public.traveler_review_reports (status, created_at desc);

alter table public.traveler_review_media enable row level security;
alter table public.traveler_review_reports enable row level security;

drop policy if exists "traveler_review_media_no_direct_access" on public.traveler_review_media;
create policy "traveler_review_media_no_direct_access" on public.traveler_review_media for all using (false) with check (false);

drop policy if exists "traveler_review_reports_no_direct_access" on public.traveler_review_reports;
create policy "traveler_review_reports_no_direct_access" on public.traveler_review_reports for all using (false) with check (false);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('traveler-review-media','traveler-review-media',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
