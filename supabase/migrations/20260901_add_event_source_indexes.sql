-- Performance indexes for AI Scout duplicate detection and event listings.
-- Safe to apply to existing data: these are non-unique indexes.

create index if not exists ai_discovered_events_source_url_idx
  on public.ai_discovered_events (source_url);

create index if not exists ai_discovered_events_start_at_idx
  on public.ai_discovered_events (start_at);

create index if not exists events_is_featured_idx
  on public.events (is_featured);

create index if not exists events_source_url_idx
  on public.events (source_url);
