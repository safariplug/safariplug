alter table public.service_staff
  add column if not exists verification_state text not null default 'unverified'
    check (verification_state in ('unverified','pending','verified','rejected','expired')),
  add column if not exists identity_liveness_verified_at timestamptz;

comment on column public.service_staff.identity_liveness_verified_at is
  'Timestamp of latest approved external identity + live face/liveness result for this individual specialist.';

alter table public.verification_cases
  drop constraint if exists verification_cases_subject_type_check;

alter table public.verification_cases
  add constraint verification_cases_subject_type_check
  check (
    subject_type = any (
      array[
        'driver'::text,
        'provider'::text,
        'vehicle'::text,
        'local'::text,
        'traveler'::text,
        'service_staff'::text
      ]
    )
  );

create unique index if not exists service_staff_user_unique_idx
  on public.service_staff(user_id)
  where user_id is not null;

create table if not exists public.service_staff_claim_tokens (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.service_staff(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.service_staff_claim_tokens enable row level security;
revoke all on table public.service_staff_claim_tokens from anon, authenticated;

create index if not exists service_staff_claim_tokens_staff_idx
  on public.service_staff_claim_tokens(staff_id, created_at desc);

create unique index if not exists verification_cases_open_service_staff_idx
  on public.verification_cases(subject_id)
  where subject_type='service_staff'
    and status in ('not_started','pending','in_review');

create or replace function public.service_staff_require_external_verification()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.verification_state='verified' then
    if new.user_id is null then
      raise exception 'Verified service specialist requires linked SafariPlug account';
    end if;
    if new.identity_liveness_verified_at is null then
      raise exception 'Verified service specialist requires identity_liveness_verified_at';
    end if;
    if not exists (
      select 1
      from public.verification_cases c
      where c.subject_type='service_staff'
        and c.subject_id=new.id
        and c.status='approved'
        and c.provider='sumsub'
        and (c.expires_at is null or c.expires_at > now())
        and exists (
          select 1 from public.verification_evidence e
          where e.case_id=c.id
            and e.evidence_type='identity'
            and e.status='accepted'
            and e.provider='sumsub'
        )
        and exists (
          select 1 from public.verification_evidence e
          where e.case_id=c.id
            and e.evidence_type='liveness'
            and e.status='accepted'
            and e.provider='sumsub'
        )
    ) then
      raise exception 'Verified service specialist requires approved external identity and liveness evidence';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists service_staff_require_external_verification_trg on public.service_staff;
create trigger service_staff_require_external_verification_trg
before insert or update of verification_state,identity_liveness_verified_at,user_id
on public.service_staff
for each row execute function public.service_staff_require_external_verification();

revoke execute on function public.service_staff_require_external_verification()
from public, anon, authenticated;

create or replace function public.create_service_appointment(
  p_service_profile_id uuid,
  p_offering_id uuid,
  p_staff_id uuid,
  p_customer_user_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_starts_at timestamptz,
  p_customer_notes text default null
) returns public.service_appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offering public.service_offerings;
  v_profile public.service_profiles;
  v_staff public.service_staff;
  v_appointment public.service_appointments;
  v_ends_at timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_day smallint;
  v_start_time time;
  v_end_time time;
begin
  if p_starts_at is null then raise exception 'booking_time_required'; end if;
  if nullif(trim(coalesce(p_customer_name, '')), '') is null then raise exception 'customer_name_required'; end if;

  select * into v_profile
  from public.service_profiles
  where id = p_service_profile_id and status = 'active' and booking_status = 'open';
  if not found then raise exception 'service_not_bookable'; end if;

  if not exists (
    select 1 from public.businesses
    where id = v_profile.business_id and status = 'active'
  ) then
    raise exception 'service_not_bookable';
  end if;

  select * into v_offering
  from public.service_offerings
  where id = p_offering_id and service_profile_id = p_service_profile_id and status = 'active';
  if not found then raise exception 'service_not_bookable'; end if;

  select * into v_staff
  from public.service_staff
  where id = p_staff_id
    and service_profile_id = p_service_profile_id
    and status = 'active'
    and personal_photo_url is not null
    and user_id is not null
    and verification_state = 'verified'
    and identity_liveness_verified_at is not null;
  if not found then raise exception 'staff_not_bookable'; end if;

  if not exists (
    select 1 from public.service_staff_offerings
    where staff_id = p_staff_id and offering_id = p_offering_id
  ) then raise exception 'staff_cannot_perform_service'; end if;

  v_ends_at := p_starts_at + make_interval(mins => v_offering.duration_minutes);

  if p_starts_at < now() + make_interval(mins => v_profile.booking_notice_minutes) then
    raise exception 'booking_notice_violation';
  end if;
  if p_starts_at > now() + make_interval(days => v_profile.max_booking_days) then
    raise exception 'booking_window_violation';
  end if;

  v_local_start := p_starts_at at time zone v_profile.timezone;
  v_local_end := v_ends_at at time zone v_profile.timezone;
  v_day := extract(dow from v_local_start)::smallint;
  v_start_time := v_local_start::time;
  v_end_time := v_local_end::time;

  if v_local_end::date <> v_local_start::date then
    raise exception 'staff_unavailable';
  end if;

  if not exists (
    select 1
    from public.service_staff_availability sa
    where sa.staff_id = p_staff_id
      and sa.is_active = true
      and sa.day_of_week = v_day
      and sa.start_time <= v_start_time
      and sa.end_time >= v_end_time
  ) then raise exception 'staff_unavailable'; end if;

  if exists (
    select 1 from public.service_staff_blockouts
    where staff_id = p_staff_id and starts_at < v_ends_at and ends_at > p_starts_at
  ) then raise exception 'staff_unavailable'; end if;

  insert into public.service_appointments(
    public_id, service_profile_id, offering_id, staff_id, customer_user_id,
    customer_name, customer_email, customer_phone, starts_at, ends_at, status,
    customer_notes, price, currency
  ) values (
    'spa_' || replace(gen_random_uuid()::text, '-', ''),
    p_service_profile_id, p_offering_id, p_staff_id, p_customer_user_id,
    trim(p_customer_name), nullif(trim(p_customer_email), ''), nullif(trim(p_customer_phone), ''),
    p_starts_at, v_ends_at,
    case when v_offering.requires_confirmation then 'pending' else 'confirmed' end,
    p_customer_notes, v_offering.price, v_offering.currency
  ) returning * into v_appointment;

  insert into public.service_appointment_status_events(
    appointment_id, from_status, to_status, actor_type, actor_user_id
  ) values (
    v_appointment.id, null, v_appointment.status,
    case when p_customer_user_id is null then 'system' else 'customer' end,
    p_customer_user_id
  );

  return v_appointment;
exception
  when exclusion_violation then raise exception 'slot_unavailable';
end;
$$;

revoke all on function public.create_service_appointment(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text)
from public, anon, authenticated;
grant execute on function public.create_service_appointment(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text)
to service_role;
