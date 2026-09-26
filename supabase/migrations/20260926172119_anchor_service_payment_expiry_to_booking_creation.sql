create or replace function public.expire_abandoned_service_appointments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select a.id
    from public.service_appointments a
    where a.status in ('pending','confirmed')
      and a.payment_status in ('unpaid','failed')
      and a.created_at < now() - interval '30 minutes'
      and not exists (
        select 1
        from public.service_payment_idempotency i
        where i.appointment_id = a.id
          and (
            i.attempt_active = true
            or i.provider_submission_state in ('submitted','uncertain')
            or (i.processing_until is not null and i.processing_until > now())
          )
      )
    order by a.created_at asc
    for update of a skip locked
  loop
    begin
      perform public.transition_service_appointment_status(
        r.id,
        'cancelled',
        'system',
        null,
        'Booking expired 30 minutes after creation without a completed or active payment attempt.'
      );
      v_count := v_count + 1;
    exception
      when others then
        raise notice 'Unable to expire abandoned service appointment %: %', r.id, sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.expire_abandoned_service_appointments() from public, anon, authenticated;
grant execute on function public.expire_abandoned_service_appointments() to service_role;
