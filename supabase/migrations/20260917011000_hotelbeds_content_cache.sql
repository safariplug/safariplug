-- Persistent Hotelbeds static content cache and controlled sync cursor.
-- Content API data is server-managed only; no public RLS policies are created.

create table if not exists public.hotelbeds_hotel_content (
  hotel_code bigint primary key,
  language text not null default 'ENG',
  name text,
  destination_code text,
  destination_name text,
  country_code text,
  category_code text,
  category_name text,
  address jsonb not null default '{}'::jsonb,
  coordinates jsonb not null default '{}'::jsonb,
  descriptions jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  facilities jsonb not null default '[]'::jsonb,
  rooms jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  supplier_last_update text,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hotelbeds_hotel_content_destination_idx
  on public.hotelbeds_hotel_content(destination_code);

create index if not exists hotelbeds_hotel_content_name_idx
  on public.hotelbeds_hotel_content(lower(name));

alter table public.hotelbeds_hotel_content enable row level security;

create table if not exists public.hotelbeds_content_sync_state (
  sync_key text primary key,
  next_from integer not null default 1 check (next_from >= 1),
  page_size integer not null default 1000 check (page_size between 1 and 1000),
  language text not null default 'ENG',
  incremental_since text,
  supplier_total integer,
  last_page_count integer not null default 0,
  status text not null default 'idle' check (status in ('idle','running','completed','failed')),
  last_error text,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.hotelbeds_content_sync_state enable row level security;

insert into public.hotelbeds_content_sync_state(sync_key)
values ('hotel-content')
on conflict (sync_key) do nothing;

create or replace function public.set_hotelbeds_content_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hotelbeds_hotel_content_updated_at on public.hotelbeds_hotel_content;
create trigger hotelbeds_hotel_content_updated_at
before update on public.hotelbeds_hotel_content
for each row execute function public.set_hotelbeds_content_updated_at();

drop trigger if exists hotelbeds_content_sync_state_updated_at on public.hotelbeds_content_sync_state;
create trigger hotelbeds_content_sync_state_updated_at
before update on public.hotelbeds_content_sync_state
for each row execute function public.set_hotelbeds_content_updated_at();
