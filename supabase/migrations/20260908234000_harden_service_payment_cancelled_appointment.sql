create or replace function public.apply_service_payment_webhook(
  p_appointment_id uuid,
  p_payment_reference text,
  p_status text,
  p_paid_at timestamptz default null,
  p_refunded_amount numeric default 0
)
returns public.service_appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.service_appointments;
  next_status text;
begin
  if p_status not in ('unpaid','pending','paid','partially_refunded','refunded','failed','disputed') then
    raise exception 'invalid_payment_status';
  end if;

  select * into a
  from public.service_appointments
  where id = p_appointment_id
  for update;
  if not found then raise exception 'appointment_not_found'; end if;

  -- A cancelled appointment must never be revived by a late provider success.
  -- Preserve already-settled money states; flag a new successful callback as disputed
  -- so the payment is visible for reconciliation/refund without making the booking payable.
  if a.status = 'cancelled' and p_status in ('paid','partially_refunded','refunded') then
    if a.payment_status in ('paid','partially_refunded','refunded','disputed') then
      return a;
    end if;
    next_status := 'disputed';
    update public.service_appointments set
      payment_status = next_status,
      payment_reference = coalesce(nullif(trim(p_payment_reference),''), payment_reference),
      updated_at = now()
    where id = a.id
    returning * into a;

    update public.service_payment_ledger set
      payment_reference = a.payment_reference,
      status = a.payment_status,
      refunded_amount = greatest(0, least(coalesce(p_refunded_amount,0), gross_amount)),
      updated_at = now()
    where appointment_id = a.id;
    return a;
  end if;

  -- Never let a late/duplicate non-terminal provider event downgrade a payment
  -- that SafariPlug has already recorded as paid or refunded.
  if a.payment_status in ('paid','partially_refunded','refunded')
     and p_status in ('unpaid','pending','failed','disputed') then
    return a;
  end if;

  next_status := p_status;
  update public.service_appointments set
    payment_status = next_status,
    payment_reference = coalesce(nullif(trim(p_payment_reference),''), payment_reference),
    paid_at = case
      when next_status in ('paid','partially_refunded','refunded') then coalesce(p_paid_at, paid_at, now())
      else paid_at
    end,
    updated_at = now()
  where id = a.id
  returning * into a;

  update public.service_payment_ledger set
    payment_reference = a.payment_reference,
    status = a.payment_status,
    paid_at = a.paid_at,
    refunded_amount = greatest(0, least(coalesce(p_refunded_amount,0), gross_amount)),
    updated_at = now()
  where appointment_id = a.id;
  return a;
end;
$$;

revoke all on function public.apply_service_payment_webhook(uuid,text,text,timestamptz,numeric) from public, anon, authenticated;
grant execute on function public.apply_service_payment_webhook(uuid,text,text,timestamptz,numeric) to service_role;
