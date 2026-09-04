-- Additive verification & trust foundation.
-- Does not alter events, cities, hotels, transfers, bookings RLS,
-- or driver table shapes. No seed rows. No fake cases.

create table if not exists public.verification_cases (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null
    check (subject_type = any (array[
      'driver'::text,
      'provider'::text,
      'vehicle'::text
    ])),
  subject_id uuid not null,
  status text not null default 'not_started'
    check (status = any (array[
      'not_started'::text,
      'pending'::text,
      'in_review'::text,
      'approved'::text,
      'rejected'::text,
      'expired'::text,
      'revoked'::text
    ])),
  verification_level text not null default 'basic'
    check (verification_level = any (array[
      'basic'::text,
      'identity'::text,
      'enhanced'::text
    ])),
  provider text not null default 'human_review',
  external_id text,
  reviewed_by text,
  reviewed_at timestamptz,
  expires_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verification_cases_subject_idx
  on public.verification_cases (subject_type, subject_id, created_at desc);
create index if not exists verification_cases_status_idx
  on public.verification_cases (status);

create table if not exists public.verification_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.verification_cases(id) on delete cascade,
  evidence_type text not null
    check (evidence_type = any (array[
      'identity'::text,
      'selfie'::text,
      'liveness'::text,
      'license'::text,
      'insurance'::text,
      'vehicle_registration'::text,
      'business_registration'::text,
      'address'::text,
      'safety_check'::text,
      'background_check'::text,
      'provider_attestation'::text
    ])),
  status text not null default 'submitted'
    check (status = any (array[
      'submitted'::text,
      'accepted'::text,
      'rejected'::text,
      'expired'::text
    ])),
  provider text not null default 'human_review',
  external_ref text,
  storage_ref text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  expires_at timestamptz,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verification_evidence_case_idx
  on public.verification_evidence (case_id);

create table if not exists public.verification_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.verification_cases(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor text,
  provider text,
  external_ref text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists verification_events_case_idx
  on public.verification_events (case_id, created_at);

-- Append-only audit trail.
create or replace function public.verification_events_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'verification_events is append-only';
end;
$$;

drop trigger if exists verification_events_no_update on public.verification_events;
create trigger verification_events_no_update
  before update or delete on public.verification_events
  for each row execute procedure public.verification_events_immutable();

-- Replace the blanket verified-block with a case-gated allow.
-- verified remains impossible unless an approved, non-expired case exists.
drop trigger if exists driver_profiles_forbid_verified on public.driver_profiles;
drop function if exists public.driver_forbid_verified();

create or replace function public.driver_require_approved_verification()
returns trigger
language plpgsql
as $$
begin
  if NEW.verification_state = 'verified' then
    if not exists (
      select 1
      from public.verification_cases c
      where c.subject_type = 'driver'
        and c.subject_id = NEW.id
        and c.status = 'approved'
        and (c.expires_at is null or c.expires_at > now())
    ) then
      raise exception 'Driver verification_state=verified requires an approved, non-expired verification case';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists driver_profiles_require_approved_verification on public.driver_profiles;
create trigger driver_profiles_require_approved_verification
  before insert or update of verification_state on public.driver_profiles
  for each row execute procedure public.driver_require_approved_verification();

-- Controlled transition. Application code must not UPDATE verification_state
-- to verified except through this function after an approved case exists.
create or replace function public.apply_driver_verification_state(
  p_driver_id uuid,
  p_state text,
  p_case_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_state not in ('unverified', 'pending', 'verified', 'rejected') then
    raise exception 'Invalid verification_state';
  end if;
  if p_state = 'verified' then
    if not exists (
      select 1
      from public.verification_cases c
      where c.id = p_case_id
        and c.subject_type = 'driver'
        and c.subject_id = p_driver_id
        and c.status = 'approved'
        and (c.expires_at is null or c.expires_at > now())
    ) then
      raise exception 'Approved verification case required';
    end if;
  end if;
  update public.driver_profiles
     set verification_state = p_state,
         updated_at = now()
   where id = p_driver_id;
end;
$$;

revoke all on function public.apply_driver_verification_state(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_driver_verification_state(uuid, text, uuid)
  to service_role;

alter table public.verification_cases enable row level security;
alter table public.verification_evidence enable row level security;
alter table public.verification_events enable row level security;

revoke all on table public.verification_cases from anon, authenticated;
revoke all on table public.verification_evidence from anon, authenticated;
revoke all on table public.verification_events from anon, authenticated;

grant all on table public.verification_cases to service_role;
grant all on table public.verification_evidence to service_role;
grant all on table public.verification_events to service_role;

comment on table public.verification_cases is
  'Private verification cases. Empty until a real review or provider exists. Not publicly readable.';
comment on table public.verification_evidence is
  'Opaque evidence references only. Do not store passport, national ID, or raw document images.';
comment on table public.verification_events is
  'Append-only verification audit trail.';
comment on column public.verification_evidence.storage_ref is
  'Opaque private storage identifier. Never expose via public APIs.';
comment on column public.verification_evidence.metadata is
  'Non-sensitive workflow metadata only. Do not store identity numbers.';
