create or replace function public.expire_old_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set status = 'expired',
      is_featured = false,
      updated_at = now()
  where status = 'approved'
    and coalesce(end_at, start_at) < now();

  delete from public.ai_discovered_events
  where coalesce(end_at, start_at) < now();
end;
$$;

select public.expire_old_events();
