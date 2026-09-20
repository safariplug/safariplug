alter policy "drivers manage own transfer rates"
on public.driver_transfer_rates
using (
  exists (
    select 1 from public.driver_profiles d
    where d.id = driver_transfer_rates.driver_id
      and d.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.driver_profiles d
    where d.id = driver_transfer_rates.driver_id
      and d.user_id = (select auth.uid())
  )
);

alter policy "drivers read own transfer requests"
on public.driver_transfer_requests
using (
  exists (
    select 1 from public.driver_profiles d
    where d.id = driver_transfer_requests.driver_id
      and d.user_id = (select auth.uid())
  )
);

alter policy "travelers read own transfer requests"
on public.driver_transfer_requests
using (traveler_id = (select auth.uid()));

alter policy "travelers create eligible transfer requests"
on public.driver_transfer_requests
with check (
  traveler_id = (select auth.uid())
  and requested_at > now()
  and exists (
    select 1 from public.verification_cases vc
    where vc.subject_type = 'traveler'
      and vc.subject_id = (select auth.uid())
      and vc.status = 'approved'
      and (vc.expires_at is null or vc.expires_at > now())
  )
  and exists (
    select 1 from public.driver_profiles d
    where d.id = driver_transfer_requests.driver_id
      and d.service_status = 'active'
      and d.verification_state = 'verified'
      and d.identity_liveness_verified_at is not null
      and d.personal_photo_url is not null
      and d.driving_license_compliance_status in ('valid','expiring_soon')
  )
  and (
    trip_id is null
    or exists (
      select 1 from public.trips t
      where t.id = driver_transfer_requests.trip_id
        and t.traveler_id = (select auth.uid())
    )
  )
);

alter policy "Users can view own appointment notifications"
on public.service_appointment_notifications
using ((select auth.uid()) = user_id);

alter policy "Users can update own appointment notifications"
on public.service_appointment_notifications
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy "travelers read own package quotes"
on public.trip_package_quotes
using (
  traveler_id = (select auth.uid())
  and exists (
    select 1 from public.trips t
    where t.id = trip_package_quotes.trip_id
      and t.traveler_id = (select auth.uid())
  )
);

alter policy "travelers read own package checkout attempts"
on public.trip_package_checkout_attempts
using (
  traveler_id = (select auth.uid())
  and exists (
    select 1 from public.trips t
    where t.id = trip_package_checkout_attempts.trip_id
      and t.traveler_id = (select auth.uid())
  )
);

alter policy "travelers read own package payment intents"
on public.trip_package_payment_intents
using (
  traveler_id = (select auth.uid())
  and exists (
    select 1 from public.trips t
    where t.id = trip_package_payment_intents.trip_id
      and t.traveler_id = (select auth.uid())
  )
);

alter policy "travelers create own local requests"
on public.local_requests
with check (
  (select auth.uid()) = traveler_id
  and exists (
    select 1 from public.verification_cases vc
    where vc.subject_type = 'traveler'
      and vc.subject_id = (select auth.uid())
      and vc.status = 'approved'
      and (vc.expires_at is null or vc.expires_at > now())
  )
  and exists (
    select 1 from public.local_profiles p
    where p.id = local_requests.local_id
      and p.service_status = 'active'
      and p.verification_state = 'verified'
      and p.identity_liveness_verified_at is not null
  )
  and (
    trip_id is null
    or exists (
      select 1 from public.trips t
      where t.id = local_requests.trip_id
        and t.traveler_id = (select auth.uid())
    )
  )
);
