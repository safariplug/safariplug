create table if not exists public.production_launch_checks (
  check_key text primary key check (check_key in (
    'public_smoke',
    'signed_in_traveler_journey',
    'booking_visible_in_account',
    'trip_attachment',
    'transfer_flow',
    'mobile_traveler_journey'
  )),
  status text not null default 'pending' check (status in ('pending','passed','failed')),
  note text null,
  verified_by uuid null references auth.users(id) on delete set null,
  verified_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.production_launch_checks enable row level security;
drop policy if exists "production_launch_checks_no_direct_access" on public.production_launch_checks;
create policy "production_launch_checks_no_direct_access" on public.production_launch_checks for all using (false) with check (false);

insert into public.production_launch_checks(check_key,status) values
  ('public_smoke','pending'),
  ('signed_in_traveler_journey','pending'),
  ('booking_visible_in_account','pending'),
  ('trip_attachment','pending'),
  ('transfer_flow','pending'),
  ('mobile_traveler_journey','pending')
on conflict (check_key) do nothing;
