create extension if not exists pg_net with schema extensions;

alter table public.ai_scout_runs
  add column if not exists provider_response_id text,
  add column if not exists provider_status text,
  add column if not exists worker_stage text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'ai_scout_worker_token') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'ai_scout_worker_token', 'Token used by Supabase Cron to wake the SafariPlug AI Scout worker');
  END IF;
END $$;

create or replace function public.verify_ai_scout_worker_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'ai_scout_worker_token'
      and decrypted_secret = p_token
  );
$$;

revoke execute on function public.verify_ai_scout_worker_token(text) from public, anon, authenticated;
grant execute on function public.verify_ai_scout_worker_token(text) to service_role;

create or replace function public.invoke_ai_scout_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_token text;
  request_id bigint;
begin
  select decrypted_secret into worker_token
  from vault.decrypted_secrets
  where name = 'ai_scout_worker_token'
  limit 1;

  if worker_token is null then
    raise exception 'AI Scout worker token is not configured';
  end if;

  select net.http_get(
    url := 'https://safariplug.com/api/cron/ai-scout/worker',
    headers := jsonb_build_object('x-scout-worker-token', worker_token, 'Accept', 'application/json'),
    timeout_milliseconds := 15000
  ) into request_id;

  return request_id;
end;
$$;

revoke execute on function public.invoke_ai_scout_worker() from public, anon, authenticated;

DO $$
DECLARE existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'safariplug-ai-scout-worker' LIMIT 1;
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;
END $$;

select cron.schedule(
  'safariplug-ai-scout-worker',
  '* * * * *',
  'select public.invoke_ai_scout_worker();'
);