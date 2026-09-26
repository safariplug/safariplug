revoke all on function public.create_service_appointment(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.create_service_appointment(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text) to service_role;

revoke all on function public.reschedule_service_appointment(uuid,uuid,timestamptz,text) from public, anon, authenticated;
grant execute on function public.reschedule_service_appointment(uuid,uuid,timestamptz,text) to service_role;

revoke all on function public.transition_service_appointment_status(uuid,text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.transition_service_appointment_status(uuid,text,text,uuid,text) to service_role;

revoke all on function public.attach_service_appointment_to_trip(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.attach_service_appointment_to_trip(uuid,uuid,uuid) to service_role;

revoke all on function public.apply_service_payment_webhook(uuid,text,text,timestamptz,numeric) from public, anon, authenticated;
grant execute on function public.apply_service_payment_webhook(uuid,text,text,timestamptz,numeric) to service_role;
