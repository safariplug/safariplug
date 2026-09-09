create or replace function public.finalize_restaurant_refund(p_refund_id uuid, p_amount numeric, p_refund_reference text)
returns table(success boolean, status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund public.food_order_refunds%rowtype;
  v_order public.food_orders%rowtype;
  v_now timestamptz := now();
begin
  select * into v_refund
  from public.food_order_refunds
  where id = p_refund_id
  for update;

  if not found then
    raise exception 'refund_not_found';
  end if;

  if v_refund.provider <> 'mpesa' then
    raise exception 'unsupported_refund_provider';
  end if;

  if round(coalesce(v_refund.amount, 0), 2) <> round(coalesce(p_amount, 0), 2) then
    raise exception 'refund_amount_mismatch';
  end if;

  if v_refund.status = 'succeeded' then
    return query select true, 'succeeded'::text;
    return;
  end if;

  if v_refund.status not in ('pending', 'processing') then
    return query select false, v_refund.status;
    return;
  end if;

  select * into v_order
  from public.food_orders
  where id = v_refund.order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.payment_status = 'refunded' then
    update public.food_order_refunds
    set status = 'succeeded',
        refund_reference = coalesce(nullif(p_refund_reference, ''), refund_reference),
        updated_at = v_now,
        processed_at = coalesce(processed_at, v_now),
        error_message = null
    where id = v_refund.id;

    update public.food_delivery_assignments
    set status = 'cancelled',
        updated_at = v_now,
        note = 'Order refunded and cancelled'
    where order_id = v_order.id
      and status in ('assigned', 'accepted', 'arrived_at_restaurant', 'picked_up', 'on_the_way');

    return query select true, 'succeeded'::text;
    return;
  end if;

  if v_order.payment_status <> 'paid' then
    raise exception 'order_not_refundable';
  end if;

  update public.food_order_refunds
  set status = 'succeeded',
      refund_reference = nullif(p_refund_reference, ''),
      updated_at = v_now,
      processed_at = v_now,
      error_message = null
  where id = v_refund.id;

  update public.food_orders
  set payment_status = 'refunded',
      refunded_amount = v_refund.amount,
      refund_reference = nullif(p_refund_reference, ''),
      refunded_at = v_now,
      status = 'cancelled',
      cancelled_at = v_now,
      cancellation_reason = 'Restaurant refund completed',
      updated_at = v_now
  where id = v_order.id;

  update public.food_delivery_assignments
  set status = 'cancelled',
      updated_at = v_now,
      note = 'Order refunded and cancelled'
  where order_id = v_order.id
    and status in ('assigned', 'accepted', 'arrived_at_restaurant', 'picked_up', 'on_the_way');

  return query select true, 'succeeded'::text;
end;
$$;

revoke all on function public.finalize_restaurant_refund(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.finalize_restaurant_refund(uuid, numeric, text) to service_role;
