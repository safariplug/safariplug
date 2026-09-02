alter table public.marketing_drafts
  add column if not exists video_job_id text,
  add column if not exists video_status text,
  add column if not exists video_prompt text,
  add column if not exists video_error text;

create index if not exists marketing_drafts_video_job_id_idx
  on public.marketing_drafts (video_job_id);
