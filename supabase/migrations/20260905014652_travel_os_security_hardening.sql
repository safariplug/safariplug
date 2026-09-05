-- Travel OS security hardening.
-- This migration is intentionally after the existing Travel OS foundation migrations.
-- It does not create Travel OS tables; those already exist in the live database.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

create or replace function public.travel_os_require_approved_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.event_id is not null and not exists (
    select 1
    from public.events e
    where e.id = NEW.event_id
      and e.status = 'approved'
  ) then
    raise exception 'Only approved events can be referenced by Travel OS records';
  end if;
  return NEW;
end;
$$;

create or replace function public.travel_os_require_approved_offering()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.offering_id is not null and not exists (
    select 1
    from public.offerings o
    where o.id = NEW.offering_id
      and o.status = 'approved'
  ) then
    raise exception 'Only approved offerings can be referenced by Travel OS records';
  end if;
  return NEW;
end;
$$;

create or replace function public.travel_os_log_booking_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.booking_status_events
      (booking_id, from_status, to_status, actor_id, note)
    values
      (NEW.id, null, NEW.status, NEW.traveler_id,
       'Quote created. Provider confirmation is not available.');
  elsif TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then
    insert into public.booking_status_events
      (booking_id, from_status, to_status, actor_id, note)
    values
      (NEW.id, OLD.status, NEW.status, auth.uid(), 'status change');
  end if;
  return NEW;
end;
$$;

create or replace function public.travel_os_lock_user_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    NEW.status := 'quote';
    NEW.supplier_reference := null;
    if NEW.price_source = 'supplier' then
      NEW.price_source := 'unconfirmed_listed';
    end if;
  end if;
  return NEW;
end;
$$;

create or replace function public.driver_assignment_booking_must_exist()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.bookings b
    where b.id = NEW.booking_id
      and b.status = any (array['confirmed'::text, 'booked'::text])
  ) then
    raise exception 'Driver assignment requires a confirmed or booked transfer';
  end if;
  return NEW;
end;
$$;

create or replace function public.verification_events_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'verification_events is append-only';
end;
$$;

create or replace function public.driver_require_approved_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if NEW.verification_state = 'verified' then
    if not exists (
      select 1
      from public.verification_cases c
      where c.subject_type = 'driver'
        and c.subject_id = NEW.id
        and c.status = 'approved'
        and (c.expires_at is null or c.expires_at > now())
    ) then
      raise exception 'Driver verification_state=verified requires an approved, non-expired verification case';
    end if;
  end if;
  return NEW;
end;
$$;

revoke execute on function public.travel_os_log_booking_status() from public, anon, authenticated;
revoke execute on function public.travel_os_require_approved_event() from public, anon, authenticated;
revoke execute on function public.travel_os_require_approved_offering() from public, anon, authenticated;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.travel_os_lock_user_booking() from public, anon, authenticated;
revoke execute on function public.driver_assignment_booking_must_exist() from public, anon, authenticated;
revoke execute on function public.verification_events_immutable() from public, anon, authenticated;
revoke execute on function public.driver_require_approved_verification() from public, anon, authenticated;
