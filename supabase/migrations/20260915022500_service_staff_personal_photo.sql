alter table public.service_staff
  add column if not exists personal_photo_url text;

comment on column public.service_staff.personal_photo_url is
  'Personal profile photo for the individual service provider. A photo alone does not imply identity verification.';
