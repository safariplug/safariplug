-- Activate an approved supplier atomically after the application-level
-- readiness gate has passed. Any failure rolls back the entire activation.

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
    and onboarding_status in ('submitted','changes_requested')
  for update;

  if v_business_id is null then
    raise exception 'Supplier is not awaiting review';
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
  where id = p_supplier_id;
end;
$$;

revoke execute on function public.activate_supplier_after_review(uuid)
from public, anon, authenticated;
grant execute on function public.activate_supplier_after_review(uuid)
to service_role;

comment on function public.activate_supplier_after_review(uuid) is
  'Server-only atomic supplier activation. Application code must pass the canonical readiness gate before calling this function.';
