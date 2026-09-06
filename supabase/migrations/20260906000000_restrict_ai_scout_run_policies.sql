drop policy if exists "Allow admin insert scout runs" on public.ai_scout_runs;
drop policy if exists "Allow admin read scout runs" on public.ai_scout_runs;

create policy "Admins can create AI scout runs"
  on public.ai_scout_runs
  for insert
  to authenticated
  with check ((select is_admin()));

create policy "Admins can view AI scout runs"
  on public.ai_scout_runs
  for select
  to authenticated
  using ((select is_admin()));
