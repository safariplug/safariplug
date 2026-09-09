-- Prevent two simultaneous assignment requests from claiming the same driver.
-- Existing order_id uniqueness already prevents more than one assignment row per order.
-- This partial unique index extends that protection to active driver work.

create unique index if not exists food_delivery_assignments_active_driver_key
  on public.food_delivery_assignments(driver_id)
  where status in ('assigned','accepted','arrived_at_restaurant','picked_up','on_the_way');

-- Make active-assignment lookups use the same predicate as the concurrency guard.
create index if not exists food_delivery_assignments_active_order_idx
  on public.food_delivery_assignments(order_id, status)
  where status in ('assigned','accepted','arrived_at_restaurant','picked_up','on_the_way');
