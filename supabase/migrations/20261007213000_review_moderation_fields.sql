alter table public.traveler_reviews
  add column if not exists moderation_note text null,
  add column if not exists moderated_by uuid null references auth.users(id) on delete set null,
  add column if not exists moderated_at timestamptz null,
  add column if not exists reported_at timestamptz null,
  add column if not exists report_reason text null;

create index if not exists traveler_reviews_moderation_queue_idx
  on public.traveler_reviews (moderation_status, created_at desc);
