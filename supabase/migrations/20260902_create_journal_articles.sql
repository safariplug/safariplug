create table if not exists public.journal_articles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid null references public.events(id) on delete set null,
  source_event_id uuid null,
  title text not null,
  slug text not null unique,
  excerpt text,
  body text not null,
  meta_title text,
  meta_description text,
  image_url text,
  category text,
  city text,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_articles_status_idx on public.journal_articles(status);
create index if not exists journal_articles_published_at_idx on public.journal_articles(published_at desc);
create index if not exists journal_articles_city_idx on public.journal_articles(city);
create index if not exists journal_articles_source_event_id_idx on public.journal_articles(source_event_id);

alter table public.journal_articles enable row level security;

drop policy if exists "Public can read published journal articles" on public.journal_articles;
create policy "Public can read published journal articles"
  on public.journal_articles
  for select
  using (status = 'published');
