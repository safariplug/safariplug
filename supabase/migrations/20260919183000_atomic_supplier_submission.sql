-- Submit supplier onboarding atomically so account and business state cannot diverge.

create or replace function public.submit_supplier_for_review(
  p_supplier_id uuid,
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_status text;
  v_completion integer;
  v_now timestamptz := now();
begin
  select business_id, onboarding_status
  into v_business_id, v_status
  from public.supplier_accounts
  where id = p_supplier_id
    and user_id = p_user_id
  for update;

  if v_business_id is null then
    raise exception 'Supplier account not found';
  end if;

  if v_status in ('approved','live') then
    raise exception 'Approved suppliers cannot be resubmitted';
  end if;

  v_completion := public.supplier_completion(v_business_id);
  if v_completion < 80 then
    raise exception 'Supplier profile must be at least 80%% complete before submission';
  end if;

  update public.businesses
  set status = 'pending',
      updated_at = v_now
  where id = v_business_id
    and owner_id = p_user_id;

  if not found then
    raise exception 'Supplier business ownership mismatch';
  end if;

  update public.supplier_accounts
  set onboarding_status = 'submitted',
      invitation_status = 'accepted',
      accepted_at = coalesce(accepted_at, v_now),
      submitted_at = v_now,
      completion_percent = v_completion,
      review_items = '[]'::jsonb,
      review_note = null,
      review_requested_at = null,
      updated_at = v_now
  where id = p_supplier_id
    and user_id = p_user_id;

  return v_completion;
end;
$$;

revoke execute on function public.submit_supplier_for_review(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.submit_supplier_for_review(uuid, uuid)
to service_role;

comment on function public.submit_supplier_for_review(uuid, uuid) is
  'Server-only atomic transition from supplier onboarding to staff review. Verifies ownership and minimum profile completion before changing business/account state.';
