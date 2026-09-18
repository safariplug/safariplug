-- Enforce traveler verification at database boundaries for peer-to-peer requests.
-- Approved traveler verification must also be unexpired.

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

drop policy if exists "travelers create own local requests"
  on public.local_requests;

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
