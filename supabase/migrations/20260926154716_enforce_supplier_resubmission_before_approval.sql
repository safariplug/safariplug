create or replace function public.submit_supplier_for_review(p_supplier_id uuid, p_user_id uuid)
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

  if v_status not in ('draft','onboarding','in_progress','changes_requested') then
    if v_status in ('approved','live') then
      raise exception 'Approved suppliers cannot be resubmitted';
    elsif v_status = 'rejected' then
      raise exception 'Rejected supplier applications cannot be resubmitted';
    elsif v_status = 'submitted' then
      raise exception 'Supplier is already awaiting review';
    else
      raise exception 'Supplier status does not allow submission: %', coalesce(v_status,'unknown');
    end if;
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

create or replace function public.activate_supplier_after_review(p_supplier_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_now timestamptz := now();
begin
  select business_id
  into v_business_id
  from public.supplier_accounts
  where id = p_supplier_id
    and onboarding_status = 'submitted'
  for update;

  if v_business_id is null then
    raise exception 'Supplier must be resubmitted and awaiting review before approval';
  end if;

  update public.service_profiles
  set status = 'active',
      booking_status = 'open'
  where business_id = v_business_id;

  update public.service_offerings so
  set status = 'active'
  from public.service_profiles sp
  where sp.id = so.service_profile_id
    and sp.business_id = v_business_id
    and so.status = 'draft';

  insert into public.service_staff_offerings(staff_id, offering_id)
  select ss.id, so.id
  from public.service_profiles sp
  join public.service_staff ss
    on ss.service_profile_id = sp.id
   and ss.status = 'active'
  join public.service_offerings so
    on so.service_profile_id = sp.id
   and so.status = 'active'
  where sp.business_id = v_business_id
  on conflict (staff_id, offering_id) do nothing;

  update public.businesses
  set status = 'active',
      updated_at = v_now
  where id = v_business_id;

  update public.supplier_accounts
  set onboarding_status = 'approved',
      approved_at = v_now,
      review_items = '[]'::jsonb,
      review_note = null,
      review_requested_at = null,
      updated_at = v_now
  where id = p_supplier_id
    and onboarding_status = 'submitted';

  if not found then
    raise exception 'Supplier review state changed before approval';
  end if;
end;
$$;

revoke all on function public.submit_supplier_for_review(uuid,uuid) from public, anon, authenticated;
revoke all on function public.activate_supplier_after_review(uuid) from public, anon, authenticated;
grant execute on function public.submit_supplier_for_review(uuid,uuid) to service_role;
grant execute on function public.activate_supplier_after_review(uuid) to service_role;
