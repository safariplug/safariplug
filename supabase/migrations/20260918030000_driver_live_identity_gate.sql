alter table public.driver_profiles
  add column if not exists identity_liveness_verified_at timestamptz;

comment on column public.driver_profiles.identity_liveness_verified_at is
  'Timestamp of the latest approved external identity + live face/liveness result. Null means the driver is not eligible to be treated as liveness-verified.';

create or replace function public.driver_require_approved_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if NEW.verification_state = 'verified' then
    if not exists (
      select 1
      from public.verification_cases c
      where c.subject_type = 'driver'
        and c.subject_id = NEW.id
        and c.status = 'approved'
        and c.provider = 'sumsub'
        and (c.expires_at is null or c.expires_at > now())
        and exists (
          select 1 from public.verification_evidence e
          where e.case_id = c.id
            and e.evidence_type = 'identity'
            and e.status = 'accepted'
            and e.provider = 'sumsub'
        )
        and exists (
          select 1 from public.verification_evidence e
          where e.case_id = c.id
            and e.evidence_type = 'liveness'
            and e.status = 'accepted'
            and e.provider = 'sumsub'
        )
    ) then
      raise exception 'Driver verification_state=verified requires approved external identity and liveness evidence';
    end if;

    if NEW.identity_liveness_verified_at is null then
      raise exception 'Driver verification_state=verified requires identity_liveness_verified_at';
    end if;
  end if;

  return NEW;
end;
$$;

revoke execute on function public.driver_require_approved_verification()
from public, anon, authenticated;

drop policy if exists "public reads eligible active transfer rates"
  on public.driver_transfer_rates;
create policy "public reads eligible active transfer rates"
on public.driver_transfer_rates
for select
using (
  status='active'
  and exists (
    select 1
    from public.driver_profiles d
    where d.id=driver_id
      and d.service_status='active'
      and d.verification_state='verified'
      and d.identity_liveness_verified_at is not null
      and d.personal_photo_url is not null
      and d.driving_license_compliance_status in ('valid','expiring_soon')
  )
);

drop policy if exists "travelers create eligible transfer requests"
  on public.driver_transfer_requests;
create policy "travelers create eligible transfer requests"
on public.driver_transfer_requests
for insert
to authenticated
with check (
  traveler_id=auth.uid()
  and requested_at > now()
  and exists (
    select 1
    from public.verification_cases vc
    where vc.subject_type='traveler'
      and vc.subject_id=auth.uid()
      and vc.status='approved'
      and (vc.expires_at is null or vc.expires_at > now())
  )
  and exists (
    select 1
    from public.driver_profiles d
    where d.id=driver_id
      and d.service_status='active'
      and d.verification_state='verified'
      and d.identity_liveness_verified_at is not null
      and d.personal_photo_url is not null
      and d.driving_license_compliance_status in ('valid','expiring_soon')
  )
  and (
    trip_id is null
    or exists (
      select 1
      from public.trips t
      where t.id=trip_id
        and t.traveler_id=auth.uid()
    )
  )
);
