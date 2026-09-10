-- Ensure every existing appointment-provider staff member can perform the
-- supplier's existing services. New records are linked by the onboarding API.
insert into public.service_staff_offerings (staff_id, offering_id)
select s.id, o.id
from public.service_staff s
join public.service_offerings o
  on o.service_profile_id = s.service_profile_id
on conflict (staff_id, offering_id) do nothing;
