-- Travel OS client-access hardening.
-- Keep server-only inventory and integration state inaccessible to anon/authenticated.
-- Allow authenticated travelers to manage only their own trips, bookings, and trip items.

alter table public.trips enable row level security;
alter table public.trip_items enable row level security;
alter table public.bookings enable row level security;
alter table public.integration_syncs enable row level security;

revoke all on table public.trips from anon;
revoke all on table public.trip_items from anon;
revoke all on table public.bookings from anon;
revoke all on table public.integration_syncs from anon, authenticated;

grant select, insert on table public.trips to authenticated;
grant select, insert on table public.trip_items to authenticated;
grant select, insert on table public.bookings to authenticated;

-- Recreate the policies so this migration is safe to apply to the recovered schema.
drop policy if exists "Travelers can view their own trips" on public.trips;
drop policy if exists "Travelers can create their own trips" on public.trips;
create policy "Travelers can view their own trips"
  on public.trips
  for select
  to authenticated
  using ((select auth.uid()) = traveler_id);
create policy "Travelers can create their own trips"
  on public.trips
  for insert
  to authenticated
  with check ((select auth.uid()) = traveler_id);

drop policy if exists "Travelers can view their own trip items" on public.trip_items;
drop policy if exists "Travelers can create their own trip items" on public.trip_items;
create policy "Travelers can view their own trip items"
  on public.trip_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.trips t
      where t.id = trip_items.trip_id
        and t.traveler_id = (select auth.uid())
    )
  );
create policy "Travelers can create their own trip items"
  on public.trip_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.trips t
      where t.id = trip_items.trip_id
        and t.traveler_id = (select auth.uid())
    )
  );

drop policy if exists "Travelers can view their own bookings" on public.bookings;
drop policy if exists "Travelers can create their own bookings" on public.bookings;
create policy "Travelers can view their own bookings"
  on public.bookings
  for select
  to authenticated
  using ((select auth.uid()) = traveler_id);
create policy "Travelers can create their own bookings"
  on public.bookings
  for insert
  to authenticated
  with check (
    (select auth.uid()) = traveler_id
    and (
      trip_id is null
      or exists (
        select 1
        from public.trips t
        where t.id = bookings.trip_id
          and t.traveler_id = (select auth.uid())
      )
    )
  );
