alter table public.marketing_drafts
  add column if not exists metricool_post_id text,
  add column if not exists metricool_status text,
  add column if not exists publish_error text;
