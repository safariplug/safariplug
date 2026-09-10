create table if not exists public.push_notification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios','android','web')),
  device_name text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists push_notification_tokens_user_idx
  on public.push_notification_tokens(user_id, enabled);

alter table public.push_notification_tokens enable row level security;

create policy "Users manage their own push tokens"
  on public.push_notification_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
