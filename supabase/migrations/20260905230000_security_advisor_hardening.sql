-- Security advisor hardening for production Travel OS.
-- Keep trigger-only functions non-executable and prevent client access to integration sync records.

create or replace function public.update_events_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

create or replace function public.mark_expired_events()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.ai_discovered_events
  set status = 'expired'
  where status = 'approved'
    and start_at < now();
  return NEW;
end;
$$;

revoke execute on function public.update_events_updated_at() from public, anon, authenticated;
revoke execute on function public.mark_expired_events() from public, anon, authenticated;

-- integration_syncs is server/admin integration state. Clients must not access it directly.
revoke all privileges on table public.integration_syncs from anon, authenticated;
