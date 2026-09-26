CREATE OR REPLACE FUNCTION public.mark_service_provider_payout_eligible()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_payment public.service_payment_ledger;
  v_profile public.service_profiles;
  v_owner uuid;
  v_account public.service_provider_payout_accounts;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  if new.payment_status <> 'paid' then
    return new;
  end if;

  select * into v_payment
  from public.service_payment_ledger
  where appointment_id = new.id;

  if not found
     or v_payment.status <> 'paid'
     or coalesce(v_payment.refunded_amount,0) > 0
     or coalesce(v_payment.provider_net_amount,0) <= 0 then
    return new;
  end if;

  select * into v_profile
  from public.service_profiles
  where id = new.service_profile_id;

  if not found or v_profile.provider_terms_accepted_at is null then
    return new;
  end if;

  select b.owner_id into v_owner
  from public.businesses b
  where b.id = v_profile.business_id;

  if v_owner is null then
    return new;
  end if;

  select * into v_account
  from public.service_provider_payout_accounts pa
  where pa.provider_user_id = v_owner
    and pa.provider = 'mpesa_b2c'
    and pa.status = 'verified'
  order by pa.updated_at desc
  limit 1;

  insert into public.service_provider_payouts(
    appointment_id,
    service_profile_id,
    provider_user_id,
    currency,
    gross_amount,
    platform_fee_percent,
    platform_fee_amount,
    processor_fee_amount,
    refund_amount,
    provider_net_amount,
    status,
    eligible_at,
    payout_minimum,
    payout_destination_phone,
    payout_destination_verified_at,
    metadata
  )
  values(
    new.id,
    v_profile.id,
    v_owner,
    v_payment.currency,
    v_payment.gross_amount,
    v_payment.platform_fee_percent,
    v_payment.platform_fee_amount,
    0,
    0,
    v_payment.provider_net_amount,
    'eligible',
    now(),
    coalesce(v_profile.payout_minimum,1000),
    case when v_account.id is not null then v_account.phone else null end,
    case when v_account.id is not null then v_account.verified_at else null end,
    jsonb_build_object('source','completed_appointment_trigger')
  )
  on conflict (appointment_id) do update set
    service_profile_id = excluded.service_profile_id,
    provider_user_id = excluded.provider_user_id,
    currency = excluded.currency,
    gross_amount = excluded.gross_amount,
    platform_fee_percent = excluded.platform_fee_percent,
    platform_fee_amount = excluded.platform_fee_amount,
    processor_fee_amount = excluded.processor_fee_amount,
    refund_amount = excluded.refund_amount,
    provider_net_amount = excluded.provider_net_amount,
    payout_minimum = excluded.payout_minimum,
    payout_destination_phone = case
      when public.service_provider_payouts.status in ('eligible','approved')
        then excluded.payout_destination_phone
      else public.service_provider_payouts.payout_destination_phone
    end,
    payout_destination_verified_at = case
      when public.service_provider_payouts.status in ('eligible','approved')
        then excluded.payout_destination_verified_at
      else public.service_provider_payouts.payout_destination_verified_at
    end,
    eligible_at = coalesce(public.service_provider_payouts.eligible_at, now()),
    updated_at = now();

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.guard_service_provider_payout_on_payment_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_payout public.service_provider_payouts;
  v_appointment_status text;
  v_reason text;
  v_safe_net numeric;
begin
  select * into v_payout
  from public.service_provider_payouts
  where appointment_id = new.appointment_id
  for update;

  if not found then
    return new;
  end if;

  select a.status into v_appointment_status
  from public.service_appointments a
  where a.id = new.appointment_id;

  v_safe_net := greatest(coalesce(new.provider_net_amount,0) - coalesce(new.refunded_amount,0),0);
  v_reason := 'Payout held/reconciliation required because service payment changed to '
    || coalesce(new.status,'unknown')
    || ' with refunded amount '
    || coalesce(new.refunded_amount,0)::text
    || ' and appointment status '
    || coalesce(v_appointment_status,'unknown');

  if new.status = 'paid'
     and coalesce(new.refunded_amount,0) = 0
     and v_appointment_status = 'completed' then
    if v_payout.status in ('eligible','approved','held','failed','cancelled') then
      update public.service_provider_payouts
      set currency = new.currency,
          gross_amount = new.gross_amount,
          platform_fee_percent = new.platform_fee_percent,
          platform_fee_amount = new.platform_fee_amount,
          refund_amount = 0,
          provider_net_amount = greatest(coalesce(new.provider_net_amount,0),0),
          updated_at = now()
      where id = v_payout.id;
    end if;
    return new;
  end if;

  if v_payout.status in ('eligible','approved') then
    update public.service_provider_payouts
    set status = 'held',
        refund_amount = greatest(coalesce(new.refunded_amount,0),0),
        provider_net_amount = v_safe_net,
        failure_reason = left(v_reason,1000),
        updated_at = now()
    where id = v_payout.id;
  elsif v_payout.status = 'held' then
    update public.service_provider_payouts
    set refund_amount = greatest(coalesce(new.refunded_amount,0),0),
        provider_net_amount = v_safe_net,
        failure_reason = left(v_reason,1000),
        updated_at = now()
    where id = v_payout.id;
  elsif v_payout.status in ('processing','paid') then
    update public.service_provider_payouts
    set refund_amount = greatest(coalesce(new.refunded_amount,0),0),
        failure_reason = left('POST_PAYOUT_RECONCILIATION_REQUIRED: ' || v_reason,1000),
        updated_at = now()
    where id = v_payout.id;
  else
    update public.service_provider_payouts
    set refund_amount = greatest(coalesce(new.refunded_amount,0),0),
        provider_net_amount = v_safe_net,
        updated_at = now()
    where id = v_payout.id;
  end if;

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.guard_service_provider_payout_on_appointment_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_payout public.service_provider_payouts;
  v_reason text;
begin
  if new.status = old.status or new.status = 'completed' then
    return new;
  end if;

  select * into v_payout
  from public.service_provider_payouts
  where appointment_id = new.id
  for update;

  if not found then
    return new;
  end if;

  v_reason := 'Payout held/reconciliation required because appointment status changed from '
    || coalesce(old.status,'unknown')
    || ' to '
    || coalesce(new.status,'unknown');

  if v_payout.status in ('eligible','approved') then
    update public.service_provider_payouts
    set status = 'held',
        failure_reason = left(v_reason,1000),
        updated_at = now()
    where id = v_payout.id;
  elsif v_payout.status in ('processing','paid') then
    update public.service_provider_payouts
    set failure_reason = left('POST_PAYOUT_RECONCILIATION_REQUIRED: ' || v_reason,1000),
        updated_at = now()
    where id = v_payout.id;
  end if;

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.approve_service_provider_payout_as_admin(p_payout_id uuid, p_admin_user_id uuid)
 RETURNS service_provider_payouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.service_provider_payouts;
  v_ledger_id uuid;
  v_appointment_status text;
  v_appointment_payment_status text;
  v_ledger_status text;
  v_refunded_amount numeric;
  v_destination_phone text;
  v_destination_verified_at timestamptz;
begin
  if not exists (
    select 1
    from public.admin_users au
    where au.user_id = p_admin_user_id
      and au.role in ('super_admin','finance_manager')
  ) then
    raise exception 'finance_admin_required';
  end if;

  select * into r
  from public.service_provider_payouts
  where id = p_payout_id
  for update;

  if not found or r.status <> 'eligible' then
    raise exception 'payout_not_eligible';
  end if;

  select a.status, a.payment_status, l.id, l.status, coalesce(l.refunded_amount,0)
    into v_appointment_status, v_appointment_payment_status, v_ledger_id, v_ledger_status, v_refunded_amount
  from public.service_appointments a
  join public.service_payment_ledger l on l.appointment_id = a.id
  where a.id = r.appointment_id
  for update of a,l;

  if not found
     or v_appointment_status <> 'completed'
     or v_appointment_payment_status <> 'paid'
     or v_ledger_status <> 'paid'
     or v_refunded_amount > 0
     or r.provider_net_amount <= 0 then
    raise exception 'payout_not_settled_completed';
  end if;

  if exists (
    select 1
    from public.travel_refund_reviews rr
    where rr.product = 'service'
      and rr.ledger_id = v_ledger_id
      and (rr.status in ('pending','in_review') or rr.resolution = 'refund_required')
  ) then
    raise exception 'payout_refund_review_open';
  end if;

  select pa.phone, pa.verified_at
    into v_destination_phone, v_destination_verified_at
  from public.service_provider_payout_accounts pa
  where pa.provider_user_id = r.provider_user_id
    and pa.provider = 'mpesa_b2c'
    and pa.status = 'verified'
    and pa.phone is not null
    and pa.verified_at is not null
  order by pa.updated_at desc
  limit 1;

  if v_destination_phone is null or v_destination_verified_at is null then
    raise exception 'payout_destination_not_verified';
  end if;

  update public.service_provider_payouts
  set status = 'approved',
      approved_at = coalesce(approved_at,now()),
      eligible_at = coalesce(eligible_at,now()),
      approved_by = p_admin_user_id,
      approval_user_id = p_admin_user_id,
      payout_destination_phone = v_destination_phone,
      payout_destination_verified_at = v_destination_verified_at,
      failure_reason = null,
      updated_at = now()
  where id = r.id
    and status = 'eligible'
  returning * into r;

  if not found then
    raise exception 'payout_not_eligible';
  end if;

  return r;
end;
$function$


CREATE OR REPLACE FUNCTION public.approve_service_provider_payout(p_payout_id uuid)
 RETURNS service_provider_payouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.service_provider_payouts;
  v_ledger_id uuid;
  v_destination_phone text;
  v_destination_verified_at timestamptz;
begin
  select * into r
  from public.service_provider_payouts
  where id = p_payout_id
  for update;

  if not found or r.status <> 'eligible' then
    raise exception 'payout_not_eligible';
  end if;

  select l.id into v_ledger_id
  from public.service_appointments a
  join public.service_payment_ledger l on l.appointment_id = a.id
  where a.id = r.appointment_id
    and a.status = 'completed'
    and a.payment_status = 'paid'
    and l.status = 'paid'
    and coalesce(l.refunded_amount,0) = 0
    and r.provider_net_amount > 0
  for update of a,l;

  if v_ledger_id is null then
    raise exception 'payout_not_settled_completed';
  end if;

  if exists (
    select 1
    from public.travel_refund_reviews rr
    where rr.product = 'service'
      and rr.ledger_id = v_ledger_id
      and (rr.status in ('pending','in_review') or rr.resolution = 'refund_required')
  ) then
    raise exception 'payout_refund_review_open';
  end if;

  select pa.phone, pa.verified_at
    into v_destination_phone, v_destination_verified_at
  from public.service_provider_payout_accounts pa
  where pa.provider_user_id = r.provider_user_id
    and pa.provider = 'mpesa_b2c'
    and pa.status = 'verified'
    and pa.phone is not null
    and pa.verified_at is not null
  order by pa.updated_at desc
  limit 1;

  if v_destination_phone is null or v_destination_verified_at is null then
    raise exception 'payout_destination_not_verified';
  end if;

  update public.service_provider_payouts
  set status = 'approved',
      approved_at = coalesce(approved_at,now()),
      eligible_at = coalesce(eligible_at,now()),
      payout_destination_phone = v_destination_phone,
      payout_destination_verified_at = v_destination_verified_at,
      failure_reason = null,
      updated_at = now()
  where id = r.id
    and status = 'eligible'
  returning * into r;

  return r;
end;
$function$


CREATE OR REPLACE FUNCTION public.claim_service_provider_payout(p_payout_id uuid)
 RETURNS service_provider_payouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.service_provider_payouts;
  v_balance numeric(12,2);
  v_min numeric(12,2);
  v_ledger_id uuid;
begin
  select * into r
  from public.service_provider_payouts
  where id = p_payout_id
  for update;

  if not found then
    raise exception 'payout_not_found';
  end if;

  if r.status <> 'approved'
     or r.currency <> 'KES'
     or r.provider_net_amount <= 0
     or r.payout_destination_phone is null
     or r.payout_destination_verified_at is null then
    raise exception 'payout_not_claimable';
  end if;

  select l.id into v_ledger_id
  from public.service_appointments a
  join public.service_payment_ledger l on l.appointment_id = a.id
  where a.id = r.appointment_id
    and a.status = 'completed'
    and a.payment_status = 'paid'
    and l.status = 'paid'
    and coalesce(l.refunded_amount,0) = 0
  for update of a,l;

  if v_ledger_id is null then
    raise exception 'payout_not_settled_completed';
  end if;

  if exists (
    select 1
    from public.travel_refund_reviews rr
    where rr.product = 'service'
      and rr.ledger_id = v_ledger_id
      and (rr.status in ('pending','in_review') or rr.resolution = 'refund_required')
  ) then
    raise exception 'payout_refund_review_open';
  end if;

  if not exists (
    select 1
    from public.service_provider_payout_accounts pa
    where pa.provider_user_id = r.provider_user_id
      and pa.provider = 'mpesa_b2c'
      and pa.status = 'verified'
      and pa.phone = r.payout_destination_phone
      and pa.verified_at is not null
  ) then
    raise exception 'payout_destination_changed_or_unverified';
  end if;

  v_min := greatest(coalesce(r.payout_minimum,1000),0);

  select coalesce(sum(p.provider_net_amount),0)
    into v_balance
  from public.service_provider_payouts p
  join public.service_appointments a on a.id = p.appointment_id
  join public.service_payment_ledger l on l.appointment_id = a.id
  where p.provider_user_id = r.provider_user_id
    and p.currency = r.currency
    and p.status in ('eligible','approved','processing')
    and p.provider_net_amount > 0
    and a.status = 'completed'
    and a.payment_status = 'paid'
    and l.status = 'paid'
    and coalesce(l.refunded_amount,0) = 0
    and not exists (
      select 1
      from public.travel_refund_reviews rr
      where rr.product = 'service'
        and rr.ledger_id = l.id
        and (rr.status in ('pending','in_review') or rr.resolution = 'refund_required')
    );

  if v_balance < v_min then
    raise exception 'payout_minimum_not_reached';
  end if;

  update public.service_provider_payouts
  set status = 'processing',
      processing_at = coalesce(processing_at,now()),
      updated_at = now()
  where id = r.id
    and status = 'approved'
  returning * into r;

  if not found then
    raise exception 'payout_not_claimable';
  end if;

  return r;
end;
$function$


CREATE OR REPLACE FUNCTION public.create_service_provider_payout_for_completed_appointment(p_appointment_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_appointment public.service_appointments;
  v_profile public.service_profiles;
  v_ledger public.service_payment_ledger;
  v_payout_id uuid;
  v_provider_user_id uuid;
  v_account public.service_provider_payout_accounts;
begin
  select * into v_appointment
  from public.service_appointments
  where id = p_appointment_id
  for update;

  if not found then raise exception 'appointment_not_found'; end if;
  if v_appointment.status <> 'completed' then raise exception 'appointment_not_completed'; end if;
  if v_appointment.payment_status <> 'paid' then raise exception 'payment_not_settled'; end if;

  select * into v_profile
  from public.service_profiles
  where id = v_appointment.service_profile_id;

  if not found then raise exception 'service_profile_not_found'; end if;
  if v_profile.provider_terms_accepted_at is null then raise exception 'provider_terms_required'; end if;

  select * into v_ledger
  from public.service_payment_ledger
  where appointment_id = p_appointment_id
  for update;

  if not found
     or v_ledger.status <> 'paid'
     or coalesce(v_ledger.refunded_amount,0) > 0
     or coalesce(v_ledger.provider_net_amount,0) <= 0 then
    raise exception 'payment_not_settled';
  end if;

  if exists (
    select 1
    from public.travel_refund_reviews rr
    where rr.product = 'service'
      and rr.ledger_id = v_ledger.id
      and (rr.status in ('pending','in_review') or rr.resolution = 'refund_required')
  ) then
    raise exception 'payout_refund_review_open';
  end if;

  select id into v_payout_id
  from public.service_provider_payouts
  where appointment_id = p_appointment_id;

  if found then
    return v_payout_id;
  end if;

  select b.owner_id into v_provider_user_id
  from public.businesses b
  where b.id = v_profile.business_id;

  select * into v_account
  from public.service_provider_payout_accounts pa
  where pa.provider_user_id = v_provider_user_id
    and pa.provider = 'mpesa_b2c'
    and pa.status = 'verified'
  order by pa.updated_at desc
  limit 1;

  insert into public.service_provider_payouts(
    appointment_id,
    service_profile_id,
    provider_user_id,
    currency,
    gross_amount,
    platform_fee_percent,
    platform_fee_amount,
    processor_fee_amount,
    refund_amount,
    provider_net_amount,
    status,
    eligible_at,
    payout_minimum,
    payout_destination_phone,
    payout_destination_verified_at,
    metadata
  )
  values(
    p_appointment_id,
    v_profile.id,
    v_provider_user_id,
    v_ledger.currency,
    v_ledger.gross_amount,
    v_ledger.platform_fee_percent,
    v_ledger.platform_fee_amount,
    0,
    0,
    v_ledger.provider_net_amount,
    'eligible',
    now(),
    coalesce(v_profile.payout_minimum,1000),
    case when v_account.id is not null then v_account.phone else null end,
    case when v_account.id is not null then v_account.verified_at else null end,
    jsonb_build_object('source','completed_appointment')
  )
  returning id into v_payout_id;

  return v_payout_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.generate_completed_service_provider_payouts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
  n integer := 0;
begin
  for r in
    select a.id
    from public.service_appointments a
    join public.service_payment_ledger l on l.appointment_id = a.id
    left join public.service_provider_payouts p on p.appointment_id = a.id
    where a.status = 'completed'
      and a.payment_status = 'paid'
      and l.status = 'paid'
      and coalesce(l.refunded_amount,0) = 0
      and coalesce(l.provider_net_amount,0) > 0
      and p.id is null
      and not exists (
        select 1
        from public.travel_refund_reviews rr
        where rr.product = 'service'
          and rr.ledger_id = l.id
          and (rr.status in ('pending','in_review') or rr.resolution = 'refund_required')
      )
  loop
    begin
      perform public.create_service_provider_payout_for_completed_appointment(r.id);
      n := n + 1;
    exception when others then
      raise notice 'payout eligibility skipped for %: %', r.id, sqlerrm;
    end;
  end loop;

  return n;
end;
$function$


CREATE OR REPLACE FUNCTION public.resolve_service_refund_review(p_review_id uuid, p_admin_user_id uuid, p_resolution text, p_notes text)
 RETURNS travel_refund_reviews
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_review public.travel_refund_reviews;
  v_ledger public.service_payment_ledger;
  v_appointment public.service_appointments;
  v_from_status text;
  v_payout_status text;
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

  select p.status into v_payout_status
  from public.service_provider_payouts p
  where p.appointment_id = v_appointment.id
  for update;

  if v_payout_status in ('processing','paid') then
    raise exception 'provider_payout_reconciliation_required';
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
$function$

drop trigger if exists service_payment_ledger_guard_provider_payout on public.service_payment_ledger;
create trigger service_payment_ledger_guard_provider_payout
after insert or update on public.service_payment_ledger
for each row execute function public.guard_service_provider_payout_on_payment_change();

drop trigger if exists service_appointments_guard_provider_payout on public.service_appointments;
create trigger service_appointments_guard_provider_payout
after update of status on public.service_appointments
for each row execute function public.guard_service_provider_payout_on_appointment_change();

revoke all on function public.mark_service_provider_payout_eligible() from public, anon, authenticated;
revoke all on function public.guard_service_provider_payout_on_payment_change() from public, anon, authenticated;
revoke all on function public.guard_service_provider_payout_on_appointment_change() from public, anon, authenticated;
revoke all on function public.approve_service_provider_payout_as_admin(uuid,uuid) from public, anon, authenticated;
revoke all on function public.approve_service_provider_payout(uuid) from public, anon, authenticated;
revoke all on function public.claim_service_provider_payout(uuid) from public, anon, authenticated;
revoke all on function public.create_service_provider_payout_for_completed_appointment(uuid) from public, anon, authenticated;
revoke all on function public.generate_completed_service_provider_payouts() from public, anon, authenticated;
revoke all on function public.resolve_service_refund_review(uuid,uuid,text,text) from public, anon, authenticated;

grant execute on function public.approve_service_provider_payout_as_admin(uuid,uuid) to service_role;
grant execute on function public.approve_service_provider_payout(uuid) to service_role;
grant execute on function public.claim_service_provider_payout(uuid) to service_role;
grant execute on function public.create_service_provider_payout_for_completed_appointment(uuid) to service_role;
grant execute on function public.generate_completed_service_provider_payouts() to service_role;
grant execute on function public.resolve_service_refund_review(uuid,uuid,text,text) to service_role;
