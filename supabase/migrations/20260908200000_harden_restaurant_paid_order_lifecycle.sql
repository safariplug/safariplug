create or replace function public.protect_food_order_payment_state()
returns trigger
language plpgsql
as $$
begin
  if old.payment_status = 'refunded' and new.payment_status <> 'refunded' then
    new.payment_status := 'refunded';
    new.payment_reference := coalesce(new.payment_reference, old.payment_reference);
    new.payment_intent_id := coalesce(new.payment_intent_id, old.payment_intent_id);
  elsif old.payment_status = 'paid' and new.payment_status not in ('paid', 'refunded') then
    new.payment_status := 'paid';
    new.payment_reference := coalesce(new.payment_reference, old.payment_reference);
    new.payment_intent_id := coalesce(new.payment_intent_id, old.payment_intent_id);
  end if;
  return new;
end;
$$;

create or replace function public.enforce_food_order_payment_lifecycle()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'pending'
     and new.status in ('accepted','preparing','ready','driver_assigned','picked_up','on_the_way','delivered')
     and new.payment_status not in ('paid','refunded') then
    raise exception using
      errcode = '23514',
      message = 'Restaurant order must be paid before fulfillment begins';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_food_order_payment_lifecycle on public.food_orders;
create trigger enforce_food_order_payment_lifecycle
before update of status on public.food_orders
for each row execute function public.enforce_food_order_payment_lifecycle();
