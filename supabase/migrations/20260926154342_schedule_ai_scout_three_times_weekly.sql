create or replace function public.enqueue_scheduled_ai_scout()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_dow integer := extract(isodow from v_today)::integer;
  v_slot integer;
  v_week_index integer;
  v_rotation jsonb := '[
    {"location":"Nairobi","category":"Music & Nightlife"},
    {"location":"Mombasa","category":"Food & Drink"},
    {"location":"Kampala","category":"Music & Nightlife"},
    {"location":"Dar es Salaam","category":"Music & Nightlife"},
    {"location":"Zanzibar","category":"Food & Drink"},
    {"location":"Kigali","category":"Culture & Arts"},
    {"location":"Accra","category":"Music & Nightlife"},
    {"location":"Lagos","category":"Music & Nightlife"},
    {"location":"Cape Town","category":"Food & Drink"},
    {"location":"Johannesburg","category":"Music & Nightlife"},
    {"location":"Addis Ababa","category":"Culture & Arts"},
    {"location":"Marrakech","category":"Culture & Arts"},
    {"location":"Cairo","category":"Culture & Arts"},
    {"location":"Diani","category":"Adventure"},
    {"location":"Nairobi","category":"Festivals"}
  ]'::jsonb;
  v_item jsonb;
  v_location text;
  v_category text;
  v_run_id uuid;
  v_day_start timestamptz;
  v_day_end timestamptz;
begin
  if v_dow = 1 then v_slot := 0;
  elsif v_dow = 3 then v_slot := 1;
  elsif v_dow = 5 then v_slot := 2;
  else
    return null;
  end if;

  if not pg_try_advisory_xact_lock(hashtext('safariplug-ai-scout-scheduler')) then
    return null;
  end if;

  v_day_start := (v_today::timestamp at time zone 'Africa/Nairobi');
  v_day_end := ((v_today + 1)::timestamp at time zone 'Africa/Nairobi');

  select id into v_run_id
  from public.ai_scout_runs
  where queued_at >= v_day_start
    and queued_at < v_day_end
    and notes like 'Queued by autonomous Monday/Wednesday/Friday AI Scout schedule.%'
  order by queued_at desc
  limit 1;

  if v_run_id is not null then
    return v_run_id;
  end if;

  v_week_index := floor((v_today - date '2026-01-05')::numeric / 7)::integer;
  v_item := v_rotation -> (((v_week_index * 3 + v_slot) % jsonb_array_length(v_rotation) + jsonb_array_length(v_rotation)) % jsonb_array_length(v_rotation));
  v_location := v_item ->> 'location';
  v_category := v_item ->> 'category';

  select id into v_run_id
  from public.ai_scout_runs
  where status in ('queued','running')
    and lower(location) = lower(v_location)
    and category = v_category
    and queued_at is not null
  order by queued_at desc
  limit 1;

  if v_run_id is not null then
    return v_run_id;
  end if;

  insert into public.ai_scout_runs(
    location,
    category,
    status,
    events_found,
    queued_at,
    started_at,
    claimed_at,
    completed_at,
    notes
  )
  values(
    v_location,
    v_category,
    'queued',
    0,
    now(),
    null,
    null,
    null,
    'Queued by autonomous Monday/Wednesday/Friday AI Scout schedule. The existing background worker will process this mission.'
  )
  returning id into v_run_id;

  return v_run_id;
end;
$$;

revoke all on function public.enqueue_scheduled_ai_scout() from public, anon, authenticated;
grant execute on function public.enqueue_scheduled_ai_scout() to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'safariplug-ai-scout-schedule'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'safariplug-ai-scout-schedule',
    '0 3 * * 1,3,5',
    'select public.enqueue_scheduled_ai_scout();'
  );
end;
$$;
