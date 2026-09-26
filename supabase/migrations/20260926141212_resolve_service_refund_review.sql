drop function if exists public.finalize_service_cancellation_after_refund_review(uuid,uuid);

create or replace function public.resolve_service_refund_review(
  p_review_id uuid,
  p_admin_user_id uuid,
  p_resolution text,
  p_notes text
)
returns public.travel_refund_reviews
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_review public.travel_refund_reviews;
  v_ledger public.service_payment_ledger;
  v_appointment public.service_appointments;
  v_from_status text;
begin
  if p_resolution not in ('refund_required','no_refund_due','refunded_externally') then
    raise exception 'invalid_refund_resolution';
  end if;
  if nullif(trim(coalesce(p_notes,'')),'') is null then
    raise exception 'finance_notes_required';
  end if;

  select * into v_review
  from public.travel_refund_reviews
  where id = p_review_id
  for update;

  if not found then raise exception 'refund_review_not_found'; end if;
  if v_review.product <> 'service' then raise exception 'refund_review_not_service'; end if;
  if v_review.status = 'resolved' then raise exception 'refund_review_already_resolved'; end if;

  select * into v_ledger
  from public.service_payment_ledger
  where id = v_review.ledger_id
  for update;

  if not found then raise exception 'service_payment_ledger_not_found'; end if;

  select * into v_appointment
  from public.service_appointments
  where id = v_ledger.appointment_id
  for update;

  if not found then raise exception 'appointment_not_found'; end if;

  if p_resolution = 'refund_required' then
    update public.travel_refund_reviews
    set status = 'in_review',
        resolution = 'refund_required',
        notes = trim(p_notes),
        assigned_to = coalesce(assigned_to,p_admin_user_id),
        resolved_by = null,
        resolved_at = null,
        updated_at = now()
    where id = v_review.id
    returning * into v_review;

    return v_review;
  end if;

  if v_appointment.status <> 'cancelled'
     and v_appointment.status not in ('pending','confirmed','checked_in','in_progress') then
    raise exception 'appointment_not_cancellable:%', v_appointment.status;
  end if;

  if p_resolution = 'no_refund_due' then
    if v_appointment.payment_status not in ('paid','partially_refunded') then
      raise exception 'no_refund_due_requires_settled_payment';
    end if;
  else
    update public.service_payment_ledger
    set status = 'refunded',
        refunded_amount = gross_amount,
        updated_at = now()
    where id = v_ledger.id;

    update public.service_appointments
    set payment_status = 'refunded',
        updated_at = now()
    where id = v_appointment.id
    returning * into v_appointment;
  end if;

  update public.travel_refund_reviews
  set status = 'resolved',
      resolution = p_resolution,
      notes = trim(p_notes),
      assigned_to = coalesce(assigned_to,p_admin_user_id),
      resolved_by = p_admin_user_id,
      resolved_at = now(),
      updated_at = now()
  where id = v_review.id
  returning * into v_review;

  if v_appointment.status <> 'cancelled' then
    v_from_status := v_appointment.status;

    update public.service_appointments
    set status = 'cancelled',
        cancellation_reason = trim(p_notes),
        updated_at = now()
    where id = v_appointment.id
    returning * into v_appointment;

    insert into public.service_appointment_status_events(
      appointment_id,
      from_status,
      to_status,
      actor_type,
      actor_user_id,
      note
    ) values (
      v_appointment.id,
      v_from_status,
      'cancelled',
      'admin',
      p_admin_user_id,
      case
        when p_resolution = 'refunded_externally' then 'Finance confirmed refund handled externally; appointment cancelled.'
        else 'Finance confirmed no refund due; appointment cancelled.'
      end
    );
  end if;

  return v_review;
end;
$$;

revoke all on function public.resolve_service_refund_review(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.resolve_service_refund_review(uuid,uuid,text,text) to service_role;
