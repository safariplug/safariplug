-- Track the production food-order lifecycle model in source control.
-- Status transitions are enforced by the application API; these values already
-- exist in the production check constraint created by the restaurant ordering migration.
-- pending -> accepted -> preparing -> ready -> driver_assigned -> picked_up -> on_the_way -> delivered
-- Cancellation/rejection are terminal states.

create index if not exists food_orders_business_status_idx
  on public.food_orders(business_id, status, created_at desc);

create index if not exists food_orders_customer_status_idx
  on public.food_orders(customer_user_id, status, created_at desc);

create index if not exists food_delivery_assignments_order_status_idx
  on public.food_delivery_assignments(order_id, status, updated_at desc);

create index if not exists food_delivery_assignments_driver_status_idx
  on public.food_delivery_assignments(driver_id, status, updated_at desc);
