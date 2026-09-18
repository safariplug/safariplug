alter table public.driver_profiles
  add column if not exists personal_photo_url text;

comment on column public.driver_profiles.personal_photo_url is
  'Public personal profile photo for the driver. This photo is separate from private identity/liveness evidence and does not itself prove verification.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('driver-profile-photos', 'driver-profile-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public=true,
  file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "drivers upload own profile photos" on storage.objects;
create policy "drivers upload own profile photos"
on storage.objects for insert to authenticated
with check (
  bucket_id='driver-profile-photos'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
);

drop policy if exists "drivers update own profile photos" on storage.objects;
create policy "drivers update own profile photos"
on storage.objects for update to authenticated
using (
  bucket_id='driver-profile-photos'
  and owner_id=(select auth.uid())::text
)
with check (
  bucket_id='driver-profile-photos'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
);

drop policy if exists "drivers delete own profile photos" on storage.objects;
create policy "drivers delete own profile photos"
on storage.objects for delete to authenticated
using (
  bucket_id='driver-profile-photos'
  and owner_id=(select auth.uid())::text
);
