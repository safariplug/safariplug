-- Pin the Hotelbeds content timestamp trigger search_path for Supabase security hardening.
create or replace function public.set_hotelbeds_content_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
