insert into public.inventory_kinds (slug,label,group_name)
values ('local','Local companion','people')
on conflict (slug) do nothing;

drop policy if exists "locals respond to own local requests" on public.local_requests;
create policy "locals respond to own local requests"
on public.local_requests
for update
to authenticated
using (
  exists (
    select 1 from public.local_profiles p
    where p.id = local_requests.local_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.local_profiles p
    where p.id = local_requests.local_id
      and p.user_id = (select auth.uid())
  )
  and status in ('accepted','declined')
);
