create or replace function public.approve_service_provider_payout_as_admin(
  p_payout_id uuid,
  p_admin_user_id uuid
)
returns public.service_provider_payouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.service_provider_payouts;
begin
  if not exists (
    select 1
    from public.admin_users au
    where au.user_id = p_admin_user_id
      and au.role in ('super_admin','finance_manager')
  ) then
    raise exception 'finance_admin_required';
  end if;

  update public.service_provider_payouts
  set
    status = 'approved',
    approved_at = coalesce(approved_at, now()),
    eligible_at = coalesce(eligible_at, now()),
    approved_by = p_admin_user_id,
    approval_user_id = p_admin_user_id,
    updated_at = now()
  where id = p_payout_id
    and status = 'eligible'
  returning * into r;

  if not found then
    raise exception 'payout_not_eligible';
  end if;

  return r;
end;
$$;

revoke all on function public.approve_service_provider_payout_as_admin(uuid,uuid) from public, anon, authenticated;
grant execute on function public.approve_service_provider_payout_as_admin(uuid,uuid) to service_role;

comment on function public.approve_service_provider_payout_as_admin(uuid,uuid) is
  'Atomically approves an eligible provider payout and records the authorized finance admin in approved_by and approval_user_id.';
