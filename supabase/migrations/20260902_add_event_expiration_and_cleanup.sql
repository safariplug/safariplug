create extension if not exists pg_cron;

alter table public.ai_discovered_events
  drop constraint if exists ai_discovered_events_status_check;

alter table public.ai_discovered_events
  add constraint ai_discovered_events_status_check
  check (status = any (array['pending_review'::text, 'approved'::text, 'rejected'::text, 'expired'::text]));

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

  update public.ai_discovered_events
  set status = 'expired',
      is_featured = false,
      updated_at = now()
  where status in ('pending_review', 'approved')
    and coalesce(end_at, start_at) < now();

  if not exists (
    select 1 from cron.job where jobname = 'safariplug-expire-old-events'
  ) then
    perform cron.schedule(
      'safariplug-expire-old-events',
      '*/15 * * * *',
      $$select public.expire_old_events()$$
    );
  end if;
end;
$$;

select public.expire_old_events();
