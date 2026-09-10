-- Link driver applications to Supabase Auth users.
-- New applications remain pending/unverified and are never bookable by default.
alter table public.driver_profiles
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists driver_profiles_user_id_uidx
  on public.driver_profiles(user_id)
  where user_id is not null;

-- Keep this table service-role-only. Public onboarding uses trusted server actions.
alter table public.driver_profiles enable row level security;
revoke all on public.driver_profiles from anon, authenticated;
