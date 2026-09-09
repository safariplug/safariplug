alter function public.sync_food_order_delivery_assignment()
  set search_path = public, pg_temp;

alter function public.validate_restaurant_menu_item_category()
  set search_path = public, pg_temp;

alter function public.validate_food_order_item_amounts()
  set search_path = public, pg_temp;

alter function public.enforce_food_order_payment_lifecycle()
  set search_path = public, pg_temp;

alter function public.protect_food_order_payment_state()
  set search_path = public, pg_temp;
