CREATE OR REPLACE FUNCTION public.reconcile_service_provider_payout_as_admin(p_payout_id uuid, p_admin_user_id uuid, p_outcome text, p_reference text, p_notes text)
 RETURNS service_provider_payouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.service_provider_payouts;
  v_reference text := nullif(trim(coalesce(p_reference,'')),'');
  v_notes text := nullif(trim(coalesce(p_notes,'')),'');
begin
  if not exists (
    select 1 from public.admin_users au
    where au.user_id = p_admin_user_id
      and au.role in ('super_admin','finance_manager')
  ) then
    raise exception 'finance_admin_required';
  end if;

  if p_outcome not in ('confirm_paid','confirm_failed') then
    raise exception 'invalid_reconciliation_outcome';
  end if;

  if v_notes is null then
    raise exception 'reconciliation_notes_required';
  end if;

  select * into r
  from public.service_provider_payouts
  where id = p_payout_id
  for update;

  if not found then
    raise exception 'payout_not_found';
  end if;

  if r.status not in ('processing','held','failed') then
    raise exception 'payout_not_reconcilable';
  end if;

  if p_outcome = 'confirm_paid' then
    if v_reference is null then
      raise exception 'payout_reference_required';
    end if;

    update public.service_provider_payouts
    set status = 'paid',
        paid_at = coalesce(paid_at,now()),
        payout_reference = v_reference,
        failure_reason = null,
        metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'manual_reconciliation', jsonb_build_object(
            'outcome','confirm_paid',
            'admin_user_id',p_admin_user_id,
            'notes',v_notes,
            'reference',v_reference,
            'recorded_at',now()
          )
        ),
        updated_at = now()
    where id = r.id
    returning * into r;
  else
    update public.service_provider_payouts
    set status = 'failed',
        failure_reason = left('Manual reconciliation: ' || v_notes,1000),
        metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'manual_reconciliation', jsonb_build_object(
            'outcome','confirm_failed',
            'admin_user_id',p_admin_user_id,
            'notes',v_notes,
            'reference',v_reference,
            'recorded_at',now()
          )
        ),
        updated_at = now()
    where id = r.id
    returning * into r;
  end if;

  insert into public.admin_telemetry_logs(action_type,metadata)
  values(
    'service_provider_payout_reconciled',
    jsonb_build_object(
      'payout_id',r.id,
      'outcome',p_outcome,
      'reference',v_reference,
      'notes',v_notes,
      'admin_user_id',p_admin_user_id,
      'status',r.status
    )
  );

  return r;
end;
$function$


CREATE OR REPLACE FUNCTION public.reconcile_service_provider_payouts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  n integer := 0;
begin
  with moved as (
    update public.service_provider_payouts
    set status='held',
        failure_reason='Reconciliation required: payout remained processing beyond the expected M-Pesa callback window',
        updated_at=now()
    where status='processing'
      and processing_at < now() - interval '24 hours'
    returning id, provider_user_id, payout_reference, conversation_id, originator_conversation_id
  )
  insert into public.admin_telemetry_logs(action_type,metadata)
  select 'service_provider_payout_stale_processing',
         jsonb_build_object(
           'payout_id',id,
           'provider_user_id',provider_user_id,
           'payout_reference',payout_reference,
           'conversation_id',conversation_id,
           'originator_conversation_id',originator_conversation_id
         )
  from moved;

  get diagnostics n = row_count;
  return n;
end;
$function$


revoke all on function public.reconcile_service_provider_payout_as_admin(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.reconcile_service_provider_payout_as_admin(uuid,uuid,text,text,text) to service_role;
revoke all on function public.reconcile_service_provider_payouts() from public, anon, authenticated;
grant execute on function public.reconcile_service_provider_payouts() to service_role;
