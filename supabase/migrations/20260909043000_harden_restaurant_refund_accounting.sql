alter table public.food_orders
  add column if not exists refunded_amount numeric not null default 0,
  add column if not exists refund_reference text,
  add column if not exists refunded_at timestamptz;

alter table public.food_orders
  drop constraint if exists food_orders_refunded_amount_nonnegative,
  drop constraint if exists food_orders_refunded_amount_not_over_total;

alter table public.food_orders
  add constraint food_orders_refunded_amount_nonnegative
    check (refunded_amount >= 0),
  add constraint food_orders_refunded_amount_not_over_total
    check (refunded_amount <= customer_total);

create or replace function public.protect_food_order_payment_state()
returns trigger
language plpgsql
as $$
begin
  if old.payment_status = 'refunded' and new.payment_status <> 'refunded' then
    new.payment_status := 'refunded';
    new.payment_reference := coalesce(new.payment_reference, old.payment_reference);
    new.payment_intent_id := coalesce(new.payment_intent_id, old.payment_intent_id);
    new.refunded_amount := greatest(new.refunded_amount, old.refunded_amount);
    new.refund_reference := coalesce(new.refund_reference, old.refund_reference);
    new.refunded_at := coalesce(new.refunded_at, old.refunded_at);
  elsif old.payment_status = 'paid' and new.payment_status not in ('paid', 'refunded', 'disputed') then
    new.payment_status := 'paid';
    new.payment_reference := coalesce(new.payment_reference, old.payment_reference);
    new.payment_intent_id := coalesce(new.payment_intent_id, old.payment_intent_id);
  end if;

  if new.status in ('accepted','preparing','ready','driver_assigned','picked_up','on_the_way','delivered')
     and new.payment_status not in ('paid','refunded') then
    raise exception using errcode = '23514', message = 'Restaurant order must be paid before fulfillment begins';
  end if;

  if old.status is distinct from new.status
     and new.status = 'cancelled'
     and old.payment_status = 'paid'
     and new.payment_status <> 'refunded' then
    raise exception using errcode = '23514', message = 'Paid restaurant orders require a refund before cancellation';
  end if;

  if new.status = 'cancelled' and old.payment_status <> 'paid' and new.payment_status = 'paid' then
    new.payment_status := 'disputed';
  end if;

  if new.payment_status = 'refunded' then
    if new.refunded_amount <= 0 then
      raise exception using errcode = '23514', message = 'Refunded restaurant orders require a positive refund amount';
    end if;
    if new.refunded_amount > new.customer_total then
      raise exception using errcode = '23514', message = 'Restaurant refund cannot exceed customer total';
    end if;
    new.refunded_at := coalesce(new.refunded_at, now());
  end if;

  return new;
end;
$$;
