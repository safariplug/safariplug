-- Keep the order and its delivery assignment synchronized even when an order
-- status is changed by a path other than the primary API route.

CREATE OR REPLACE FUNCTION public.sync_food_order_delivery_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'rejected') THEN
    UPDATE public.food_delivery_assignments
    SET status = 'cancelled',
        updated_at = COALESCE(NEW.updated_at, now())
    WHERE order_id = NEW.id
      AND status IN ('assigned', 'accepted', 'arrived_at_restaurant', 'picked_up', 'on_the_way');
  ELSIF NEW.status = 'delivered' THEN
    UPDATE public.food_delivery_assignments
    SET status = 'delivered',
        updated_at = COALESCE(NEW.updated_at, now())
    WHERE order_id = NEW.id
      AND status IN ('assigned', 'accepted', 'arrived_at_restaurant', 'picked_up', 'on_the_way');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_food_order_delivery_assignment ON public.food_orders;
CREATE TRIGGER sync_food_order_delivery_assignment
AFTER UPDATE OF status ON public.food_orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_food_order_delivery_assignment();

REVOKE ALL ON FUNCTION public.sync_food_order_delivery_assignment() FROM PUBLIC;
