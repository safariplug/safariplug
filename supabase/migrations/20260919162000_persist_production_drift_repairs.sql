-- Persist production drift repairs discovered during the 2026-09-19 audit.
-- These changes make trigger behavior match the canonical current schema and
-- keep trigger-only helpers inaccessible to direct client RPC calls.

-- Driver liveness must remain enforced if either verification state OR the
-- liveness timestamp changes.
alter table public.driver_profiles
  add column if not exists identity_liveness_verified_at timestamptz;

comment on column public.driver_profiles.identity_liveness_verified_at is
  'Timestamp of the latest approved external identity + live face/liveness result. Null means the driver is not eligible to be treated as liveness-verified.';

create or replace function public.driver_require_approved_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.verification_state = 'verified' then
    if not exists (
      select 1
      from public.verification_cases c
      where c.subject_type = 'driver'
        and c.subject_id = new.id
        and c.status = 'approved'
        and c.provider = 'sumsub'
        and (c.expires_at is null or c.expires_at > now())
        and exists (
          select 1 from public.verification_evidence e
          where e.case_id = c.id
            and e.evidence_type = 'identity'
            and e.status = 'accepted'
            and e.provider = 'sumsub'
        )
        and exists (
          select 1 from public.verification_evidence e
          where e.case_id = c.id
            and e.evidence_type = 'liveness'
            and e.status = 'accepted'
            and e.provider = 'sumsub'
        )
    ) then
      raise exception 'Driver verification_state=verified requires approved external identity and liveness evidence';
    end if;

    if new.identity_liveness_verified_at is null then
      raise exception 'Driver verification_state=verified requires identity_liveness_verified_at';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists driver_profiles_require_approved_verification on public.driver_profiles;
create trigger driver_profiles_require_approved_verification
before insert or update of verification_state, identity_liveness_verified_at
on public.driver_profiles
for each row execute function public.driver_require_approved_verification();

revoke execute on function public.driver_require_approved_verification() from public, anon, authenticated;
grant execute on function public.driver_require_approved_verification() to service_role;

-- Restore hotel ledger updated_at maintenance and pin the function search path.
create or replace function public.set_hotel_booking_pricing_ledger_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hotel_booking_pricing_ledger_updated_at on public.hotel_booking_pricing_ledger;
create trigger hotel_booking_pricing_ledger_updated_at
before update on public.hotel_booking_pricing_ledger
for each row execute function public.set_hotel_booking_pricing_ledger_updated_at();

revoke execute on function public.set_hotel_booking_pricing_ledger_updated_at() from public, anon, authenticated;
grant execute on function public.set_hotel_booking_pricing_ledger_updated_at() to service_role;

-- Restore restaurant updated_at maintenance and pin the function search path.
create or replace function public.set_restaurant_food_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists restaurant_settings_updated_at on public.restaurant_settings;
create trigger restaurant_settings_updated_at before update on public.restaurant_settings
for each row execute function public.set_restaurant_food_updated_at();

drop trigger if exists restaurant_menu_categories_updated_at on public.restaurant_menu_categories;
create trigger restaurant_menu_categories_updated_at before update on public.restaurant_menu_categories
for each row execute function public.set_restaurant_food_updated_at();

drop trigger if exists restaurant_menu_items_updated_at on public.restaurant_menu_items;
create trigger restaurant_menu_items_updated_at before update on public.restaurant_menu_items
for each row execute function public.set_restaurant_food_updated_at();

drop trigger if exists food_orders_updated_at on public.food_orders;
create trigger food_orders_updated_at before update on public.food_orders
for each row execute function public.set_restaurant_food_updated_at();

drop trigger if exists food_delivery_assignments_updated_at on public.food_delivery_assignments;
create trigger food_delivery_assignments_updated_at before update on public.food_delivery_assignments
for each row execute function public.set_restaurant_food_updated_at();

revoke execute on function public.set_restaurant_food_updated_at() from public, anon, authenticated;
grant execute on function public.set_restaurant_food_updated_at() to service_role;

-- The legacy service_appointment_id column was removed. Keep trip timing synced
-- through the canonical trip_items.appointment_id relation.
create or replace function public.sync_service_appointment_journey_times()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at then
    update public.trip_items
    set start_at = new.starts_at,
        end_at = new.ends_at
    where appointment_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_service_appointment_journey_times on public.service_appointments;
create trigger sync_service_appointment_journey_times
after update of starts_at, ends_at on public.service_appointments
for each row execute function public.sync_service_appointment_journey_times();

revoke execute on function public.sync_service_appointment_journey_times() from public, anon, authenticated;
grant execute on function public.sync_service_appointment_journey_times() to service_role;

-- These helpers are invoked only by triggers; direct client execution is unnecessary.
revoke execute on function public.sanitize_ai_discovered_event_image() from public, anon, authenticated;
grant execute on function public.sanitize_ai_discovered_event_image() to service_role;

revoke execute on function public.set_hotelbeds_content_updated_at() from public, anon, authenticated;
grant execute on function public.set_hotelbeds_content_updated_at() to service_role;

revoke execute on function public.sync_hotel_trip_item_ledger_reference() from public, anon, authenticated;
grant execute on function public.sync_hotel_trip_item_ledger_reference() to service_role;


-- Additional trigger-only restaurant/payment helpers found during the same audit.
revoke execute on function public.enforce_food_order_payment_lifecycle() from public, anon, authenticated;
grant execute on function public.enforce_food_order_payment_lifecycle() to service_role;

revoke execute on function public.validate_food_order_item_amounts() from public, anon, authenticated;
grant execute on function public.validate_food_order_item_amounts() to service_role;

revoke execute on function public.validate_restaurant_menu_item_category() from public, anon, authenticated;
grant execute on function public.validate_restaurant_menu_item_category() to service_role;
