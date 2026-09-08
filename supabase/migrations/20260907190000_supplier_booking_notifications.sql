alter table public.service_profiles
  add column if not exists notification_email boolean not null default true,
  add column if not exists notification_whatsapp boolean not null default true;

create index if not exists service_profiles_notification_idx
  on public.service_profiles(notification_email, notification_whatsapp);
