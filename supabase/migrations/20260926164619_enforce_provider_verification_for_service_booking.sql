CREATE OR REPLACE FUNCTION public.guard_service_appointment_provider_verification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_provider_user_id uuid;
begin
  select b.owner_id
    into v_provider_user_id
  from public.service_profiles sp
  join public.businesses b on b.id = sp.business_id
  where sp.id = new.service_profile_id;

  if v_provider_user_id is null then
    raise exception 'service_provider_not_found';
  end if;

  if not public.service_provider_verification_ready(v_provider_user_id) then
    raise exception 'provider_verification_not_current';
  end if;

  return new;
end;
$function$


drop trigger if exists service_appointments_provider_verification_guard on public.service_appointments;
create trigger service_appointments_provider_verification_guard
before insert or update of starts_at,service_profile_id on public.service_appointments
for each row execute function public.guard_service_appointment_provider_verification();

revoke all on function public.guard_service_appointment_provider_verification() from public, anon, authenticated;
grant execute on function public.guard_service_appointment_provider_verification() to service_role;
