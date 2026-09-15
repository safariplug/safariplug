insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('local-profile-photos', 'local-profile-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "locals upload own profile photos" on storage.objects;
create policy "locals upload own profile photos" on storage.objects for insert to authenticated
with check (bucket_id='local-profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));

drop policy if exists "locals update own profile photos" on storage.objects;
create policy "locals update own profile photos" on storage.objects for update to authenticated
using (bucket_id='local-profile-photos' and owner_id=(select auth.uid())::text)
with check (bucket_id='local-profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));

drop policy if exists "locals delete own profile photos" on storage.objects;
create policy "locals delete own profile photos" on storage.objects for delete to authenticated
using (bucket_id='local-profile-photos' and owner_id=(select auth.uid())::text);
