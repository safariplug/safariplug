-- Keep restaurant payment state monotonic at the database boundary.
-- A late provider failure or duplicate pending callback must never downgrade
-- a successfully paid/refunded order.

CREATE OR REPLACE FUNCTION public.protect_food_order_payment_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.payment_status = 'refunded' AND NEW.payment_status <> 'refunded' THEN
    NEW.payment_status := 'refunded';
    NEW.payment_reference := COALESCE(NEW.payment_reference, OLD.payment_reference);
    NEW.payment_intent_id := COALESCE(NEW.payment_intent_id, OLD.payment_intent_id);
  ELSIF OLD.payment_status = 'paid' AND NEW.payment_status NOT IN ('paid', 'refunded') THEN
    NEW.payment_status := 'paid';
    NEW.payment_reference := COALESCE(NEW.payment_reference, OLD.payment_reference);
    NEW.payment_intent_id := COALESCE(NEW.payment_intent_id, OLD.payment_intent_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_food_order_payment_state ON public.food_orders;
CREATE TRIGGER protect_food_order_payment_state
BEFORE UPDATE OF payment_status ON public.food_orders
FOR EACH ROW
EXECUTE FUNCTION public.protect_food_order_payment_state();

REVOKE ALL ON FUNCTION public.protect_food_order_payment_state() FROM PUBLIC;
