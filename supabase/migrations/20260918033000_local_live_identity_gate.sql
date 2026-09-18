alter table public.local_profiles
  add column if not exists identity_liveness_verified_at timestamptz;

comment on column public.local_profiles.identity_liveness_verified_at is
  'Timestamp of latest approved external identity + live face/liveness verification. Public photo alone is not verification.';

create or replace function public.local_require_approved_verification()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.verification_state='verified' then
    if new.identity_liveness_verified_at is null then
      raise exception 'Local verification_state=verified requires identity_liveness_verified_at';
    end if;

    if not exists (
      select 1
      from public.verification_cases c
      where c.subject_type='local'
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
      raise exception 'Local verification_state=verified requires approved external identity and liveness evidence';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists local_require_approved_verification_trg on public.local_profiles;
create trigger local_require_approved_verification_trg
before insert or update of verification_state,identity_liveness_verified_at
on public.local_profiles
for each row execute function public.local_require_approved_verification();

revoke execute on function public.local_require_approved_verification() from public,anon,authenticated;

drop policy if exists "anonymous can view active verified locals" on public.local_profiles;
create policy "anonymous can view active verified locals"
on public.local_profiles for select to anon
using (
  service_status='active'
  and verification_state='verified'
  and identity_liveness_verified_at is not null
);

drop policy if exists "locals profile read access" on public.local_profiles;
create policy "locals profile read access"
on public.local_profiles for select to authenticated
using (
  (
    service_status='active'
    and verification_state='verified'
    and identity_liveness_verified_at is not null
  )
  or (select auth.uid())=user_id
);

drop policy if exists "anonymous can view verified local availability" on public.local_availability;
create policy "anonymous can view verified local availability"
on public.local_availability for select to anon
using (
  exists (
    select 1 from public.local_profiles p
    where p.id=local_id
      and p.service_status='active'
      and p.verification_state='verified'
      and p.identity_liveness_verified_at is not null
  )
);

drop policy if exists "authenticated local availability read" on public.local_availability;
create policy "authenticated local availability read"
on public.local_availability for select to authenticated
using (
  exists (
    select 1 from public.local_profiles p
    where p.id=local_id
      and (
        (
          p.service_status='active'
          and p.verification_state='verified'
          and p.identity_liveness_verified_at is not null
        )
        or p.user_id=(select auth.uid())
      )
  )
);

drop policy if exists "travelers create own local requests" on public.local_requests;
create policy "travelers create own local requests"
on public.local_requests
for insert
to authenticated
with check (
  auth.uid()=traveler_id
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
    from public.local_profiles p
    where p.id=local_id
      and p.service_status='active'
      and p.verification_state='verified'
      and p.identity_liveness_verified_at is not null
  )
  and (
    trip_id is null
    or exists (
      select 1 from public.trips t
      where t.id=trip_id
        and t.traveler_id=auth.uid()
    )
  )
);
