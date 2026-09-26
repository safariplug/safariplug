CREATE OR REPLACE FUNCTION public.notify_service_provider_payout_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_type text;
  v_title text;
  v_body text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  case new.status
    when 'eligible' then
      v_type := 'service_payout_eligible';
      v_title := 'Earnings ready for review';
      v_body := 'Your completed service earnings passed the initial payout checks and are ready for SafariPlug finance review.';
    when 'approved' then
      v_type := 'service_payout_approved';
      v_title := 'Payout approved';
      v_body := 'SafariPlug finance approved this provider payout. It has not been sent to M-Pesa yet.';
    when 'processing' then
      v_type := 'service_payout_processing';
      v_title := 'Payout submitted to M-Pesa';
      v_body := 'Your provider payout was submitted to M-Pesa and is awaiting the final provider result.';
    when 'paid' then
      v_type := 'service_payout_paid';
      v_title := 'Provider payout paid';
      v_body := 'SafariPlug recorded this provider payout as paid.'
        || case when nullif(new.payout_reference,'') is not null then ' Reference: ' || new.payout_reference || '.' else '' end;
    when 'held' then
      v_type := 'service_payout_held';
      v_title := 'Provider payout on hold';
      v_body := 'This provider payout is on hold while SafariPlug finance reviews a payment, refund, appointment or reconciliation issue.';
    when 'failed' then
      v_type := 'service_payout_failed';
      v_title := 'Provider payout needs review';
      v_body := 'The provider payout did not complete successfully and SafariPlug finance needs to review it before another payout action.';
    when 'cancelled' then
      v_type := 'service_payout_cancelled';
      v_title := 'Provider payout cancelled';
      v_body := 'This provider payout was cancelled. Open Earnings & payouts for the current recorded status.';
    else
      return new;
  end case;

  if new.provider_user_id is not null
     and new.appointment_id is not null
     and not exists (
       select 1
       from public.service_appointment_notifications n
       where n.user_id = new.provider_user_id
         and n.appointment_id = new.appointment_id
         and n.type = v_type
     ) then
    insert into public.service_appointment_notifications(user_id,appointment_id,type,title,body)
    values(new.provider_user_id,new.appointment_id,v_type,v_title,v_body);
  end if;

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.notify_service_refund_review_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ledger public.service_payment_ledger;
  v_appointment public.service_appointments;
  v_business_id uuid;
  v_customer_user_id uuid;
  v_provider_user_id uuid;
  v_type text;
  v_title text;
  v_customer_body text;
  v_provider_body text;
  v_changed boolean := false;
begin
  if new.product <> 'service' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_changed := true;
  elsif old.status is distinct from new.status
     or old.resolution is distinct from new.resolution then
    v_changed := true;
  end if;

  if not v_changed then
    return new;
  end if;

  select * into v_ledger
  from public.service_payment_ledger
  where id = new.ledger_id;

  if not found then
    return new;
  end if;

  select * into v_appointment
  from public.service_appointments
  where id = v_ledger.appointment_id;

  if not found then
    return new;
  end if;

  v_customer_user_id := v_appointment.customer_user_id;

  select sp.business_id into v_business_id
  from public.service_profiles sp
  where sp.id = v_appointment.service_profile_id;

  select coalesce(
    (
      select sa.user_id
      from public.supplier_accounts sa
      where sa.business_id = v_business_id
      order by sa.created_at asc
      limit 1
    ),
    (
      select b.owner_id
      from public.businesses b
      where b.id = v_business_id
    )
  ) into v_provider_user_id;

  if new.status = 'resolved' and new.resolution = 'refunded_externally' then
    v_type := 'service_refund_confirmed';
    v_title := 'Refund confirmed';
    v_customer_body := 'SafariPlug finance confirmed that your service refund was handled. The appointment is cancelled and the payment record is marked refunded.';
    v_provider_body := 'SafariPlug finance confirmed the customer refund. The appointment is cancelled and the related payout is not eligible for release.';
  elsif new.status = 'resolved' and new.resolution = 'no_refund_due' then
    v_type := 'service_refund_no_refund_due';
    v_title := 'Cancellation review completed';
    v_customer_body := 'SafariPlug finance completed the paid cancellation review. The appointment is cancelled and the finance decision recorded no refund due.';
    v_provider_body := 'SafariPlug finance completed the paid cancellation review. The appointment is cancelled and the finance decision recorded no refund due.';
  elsif new.resolution = 'refund_required' and new.status = 'in_review' then
    v_type := 'service_refund_required';
    v_title := 'Refund required';
    v_customer_body := 'SafariPlug finance confirmed that a refund is required. The case remains open until the refund is actually completed.';
    v_provider_body := 'SafariPlug finance confirmed that the customer refund is required. The case remains open and provider payout release is blocked while finance completes it.';
  else
    v_type := 'service_refund_review_open';
    v_title := 'Cancellation under finance review';
    v_customer_body := 'SafariPlug finance is reviewing the paid service cancellation request. The appointment remains active until the review is completed.';
    v_provider_body := 'SafariPlug finance is reviewing the paid service cancellation request. The appointment remains active until the review is completed.';
  end if;

  if v_customer_user_id is not null
     and not exists (
       select 1
       from public.service_appointment_notifications n
       where n.user_id = v_customer_user_id
         and n.appointment_id = v_appointment.id
         and n.type = v_type
     ) then
    insert into public.service_appointment_notifications(user_id,appointment_id,type,title,body)
    values(v_customer_user_id,v_appointment.id,v_type,v_title,v_customer_body);
  end if;

  if v_provider_user_id is not null
     and v_provider_user_id is distinct from v_customer_user_id
     and not exists (
       select 1
       from public.service_appointment_notifications n
       where n.user_id = v_provider_user_id
         and n.appointment_id = v_appointment.id
         and n.type = v_type
     ) then
    insert into public.service_appointment_notifications(user_id,appointment_id,type,title,body)
    values(v_provider_user_id,v_appointment.id,v_type,v_title,v_provider_body);
  end if;

  return new;
end;
$function$


drop trigger if exists travel_refund_reviews_notify_service_users on public.travel_refund_reviews;
create trigger travel_refund_reviews_notify_service_users
after insert or update of status,resolution on public.travel_refund_reviews
for each row execute function public.notify_service_refund_review_change();

drop trigger if exists service_provider_payouts_notify_provider on public.service_provider_payouts;
create trigger service_provider_payouts_notify_provider
after insert or update of status on public.service_provider_payouts
for each row execute function public.notify_service_provider_payout_change();

revoke all on function public.notify_service_refund_review_change() from public, anon, authenticated;
revoke all on function public.notify_service_provider_payout_change() from public, anon, authenticated;
