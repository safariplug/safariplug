alter table public.driver_transfer_requests
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='driver_transfer_requests_payment_status_check'
      and conrelid='public.driver_transfer_requests'::regclass
  ) then
    alter table public.driver_transfer_requests
      add constraint driver_transfer_requests_payment_status_check
      check (payment_status in ('unpaid','pending','paid','failed','refunded','disputed'));
  end if;
end $$;

create table if not exists public.driver_transfer_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.driver_transfer_requests(id) on delete cascade,
  traveler_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'mpesa',
  idempotency_key text not null,
  provider_reference text,
  status text not null default 'submitting'
    check (status in ('submitting','processing','succeeded','failed','uncertain')),
  amount numeric not null check (amount > 0),
  currency text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (traveler_id,idempotency_key)
);

create unique index if not exists driver_transfer_payment_attempts_provider_reference_key
  on public.driver_transfer_payment_attempts(provider_reference)
  where provider_reference is not null;

create index if not exists driver_transfer_payment_attempts_request_idx
  on public.driver_transfer_payment_attempts(request_id,created_at desc);

alter table public.driver_transfer_payment_attempts enable row level security;
revoke all on public.driver_transfer_payment_attempts from anon, authenticated;
grant select,insert,update,delete on public.driver_transfer_payment_attempts to service_role;

create or replace function public.respond_to_driver_transfer_request(
  p_request_id uuid,
  p_decision text
)
returns public.driver_transfer_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.driver_profiles;
  v_request public.driver_transfer_requests;
  v_conflict boolean;
  v_verified boolean;
  v_vehicle_ok boolean;
begin
  if p_decision not in ('accepted','declined') then
    raise exception 'invalid_decision';
  end if;

  select * into v_driver
  from public.driver_profiles
  where user_id = auth.uid();

  if v_driver.id is null then raise exception 'driver_profile_required'; end if;

  select * into v_request
  from public.driver_transfer_requests
  where id = p_request_id and driver_id = v_driver.id
  for update;

  if v_request.id is null then raise exception 'request_not_found'; end if;
  if v_request.status <> 'requested' then raise exception 'request_already_resolved'; end if;

  if p_decision = 'accepted' then
    if v_request.quoted_amount is null or v_request.quoted_amount <= 0 then
      raise exception 'transfer_quote_required';
    end if;

    if v_driver.service_status <> 'active'
      or v_driver.verification_state <> 'verified'
      or v_driver.driving_license_compliance_status not in ('valid','expiring_soon') then
      raise exception 'driver_not_eligible';
    end if;

    select exists (
      select 1 from public.verification_cases vc
      where vc.subject_type = 'driver'
        and vc.subject_id = v_driver.id
        and vc.status = 'approved'
        and (vc.expires_at is null or vc.expires_at > now())
        and (vc.provider = 'human_review' or v_driver.identity_liveness_verified_at is not null)
    ) into v_verified;

    if not v_verified then raise exception 'driver_verification_not_current'; end if;

    select exists (
      select 1 from public.vehicles v
      where v.driver_id = v_driver.id
        and v.status = 'active'
        and v.registration_compliance_status in ('valid','expiring_soon')
        and v.insurance_compliance_status in ('valid','expiring_soon')
        and (v.passenger_capacity is null or v.passenger_capacity >= v_request.passenger_count)
    ) into v_vehicle_ok;

    if not v_vehicle_ok then raise exception 'driver_vehicle_not_eligible'; end if;

    select exists (
      select 1 from public.driver_availability a
      where a.driver_id = v_driver.id
        and a.available_on = v_request.requested_at::date
        and a.status = 'unavailable'
        and (a.start_time is null or a.start_time <= v_request.requested_at::time)
        and (a.end_time is null or a.end_time > v_request.requested_at::time)
    ) into v_conflict;

    if v_conflict then raise exception 'driver_unavailable'; end if;
  end if;

  update public.driver_transfer_requests
  set status = p_decision, updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.respond_to_driver_transfer_request(uuid,text) from public, anon;
grant execute on function public.respond_to_driver_transfer_request(uuid,text) to authenticated, service_role;

create or replace function public.complete_driver_transfer_request(
  p_request_id uuid
)
returns public.driver_transfer_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.driver_profiles;
  v_request public.driver_transfer_requests;
begin
  select * into v_driver
  from public.driver_profiles
  where user_id = auth.uid();

  if v_driver.id is null then raise exception 'driver_profile_required'; end if;

  select * into v_request
  from public.driver_transfer_requests
  where id = p_request_id and driver_id = v_driver.id
  for update;

  if v_request.id is null then raise exception 'request_not_found'; end if;
  if v_request.status <> 'accepted' then raise exception 'request_not_completable'; end if;
  if v_request.payment_status <> 'paid' then raise exception 'transfer_payment_required'; end if;
  if v_request.requested_at > now() then raise exception 'ride_not_started'; end if;

  update public.driver_transfer_requests
  set status = 'completed', updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.complete_driver_transfer_request(uuid) from public, anon;
grant execute on function public.complete_driver_transfer_request(uuid) to authenticated, service_role;
