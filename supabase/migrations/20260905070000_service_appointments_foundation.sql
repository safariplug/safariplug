create extension if not exists btree_gist;

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, description text,
  status text not null default 'active' check (status in ('active','inactive')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.service_profiles (
  id uuid primary key default gen_random_uuid(), business_id uuid not null unique references public.businesses(id) on delete cascade,
  category_id uuid references public.service_categories(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','active','inactive','suspended')),
  booking_status text not null default 'closed' check (booking_status in ('closed','open','paused')),
  timezone text not null default 'Africa/Nairobi', cancellation_policy text,
  booking_notice_minutes integer not null default 60 check (booking_notice_minutes >= 0), max_booking_days integer not null default 90 check (max_booking_days > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.service_staff (
  id uuid primary key default gen_random_uuid(), service_profile_id uuid not null references public.service_profiles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, display_name text not null, bio text,
  status text not null default 'active' check (status in ('active','inactive')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.service_offerings (
  id uuid primary key default gen_random_uuid(), service_profile_id uuid not null references public.service_profiles(id) on delete cascade,
  category_id uuid references public.service_categories(id) on delete set null, name text not null, slug text not null, description text,
  duration_minutes integer not null check (duration_minutes between 5 and 1440), price numeric(12,2) not null check (price >= 0), currency text not null default 'KES',
  status text not null default 'draft' check (status in ('draft','active','inactive')), requires_confirmation boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(service_profile_id, slug)
);
create table if not exists public.service_staff_offerings (
  staff_id uuid not null references public.service_staff(id) on delete cascade, offering_id uuid not null references public.service_offerings(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (staff_id, offering_id)
);
create table if not exists public.service_staff_availability (
  id uuid primary key default gen_random_uuid(), staff_id uuid not null references public.service_staff(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), start_time time not null, end_time time not null, is_active boolean not null default true,
  check (end_time > start_time), unique(staff_id, day_of_week, start_time, end_time)
);
create table if not exists public.service_staff_blockouts (
  id uuid primary key default gen_random_uuid(), staff_id uuid not null references public.service_staff(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null, reason text, check (ends_at > starts_at)
);
create table if not exists public.service_appointments (
  id uuid primary key default gen_random_uuid(), public_id text not null unique,
  service_profile_id uuid not null references public.service_profiles(id) on delete restrict, offering_id uuid not null references public.service_offerings(id) on delete restrict,
  staff_id uuid not null references public.service_staff(id) on delete restrict, customer_user_id uuid references auth.users(id) on delete set null,
  customer_name text not null, customer_email text, customer_phone text, starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','confirmed','checked_in','in_progress','completed','cancelled','no_show')),
  customer_notes text, provider_notes text, price numeric(12,2) not null check (price >= 0), currency text not null,
  cancellation_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (ends_at > starts_at)
);
create table if not exists public.service_appointment_status_events (
  id uuid primary key default gen_random_uuid(), appointment_id uuid not null references public.service_appointments(id) on delete cascade,
  from_status text, to_status text not null, actor_type text not null check (actor_type in ('customer','provider','admin','system')),
  actor_user_id uuid references auth.users(id) on delete set null, note text, created_at timestamptz not null default now()
);
create index if not exists service_profiles_status_idx on public.service_profiles(status, booking_status);
create index if not exists service_offerings_profile_status_idx on public.service_offerings(service_profile_id, status);
create index if not exists service_staff_profile_status_idx on public.service_staff(service_profile_id, status);
create index if not exists service_staff_availability_staff_day_idx on public.service_staff_availability(staff_id, day_of_week, is_active);
create index if not exists service_staff_blockouts_staff_time_idx on public.service_staff_blockouts(staff_id, starts_at, ends_at);
create index if not exists service_appointments_profile_time_idx on public.service_appointments(service_profile_id, starts_at, ends_at);
create index if not exists service_appointments_customer_idx on public.service_appointments(customer_user_id, starts_at desc);
create index if not exists service_appointments_staff_time_idx on public.service_appointments(staff_id, starts_at, ends_at);
create index if not exists service_appointment_status_events_idx on public.service_appointment_status_events(appointment_id, created_at);
alter table public.service_appointments drop constraint if exists service_appointments_staff_no_overlap;
alter table public.service_appointments add constraint service_appointments_staff_no_overlap exclude using gist (staff_id with =, tstzrange(starts_at, ends_at, '[)') with &&) where (status in ('pending','confirmed','checked_in','in_progress'));

alter table public.service_categories enable row level security;
alter table public.service_profiles enable row level security;
alter table public.service_staff enable row level security;
alter table public.service_offerings enable row level security;
alter table public.service_staff_offerings enable row level security;
alter table public.service_staff_availability enable row level security;
alter table public.service_staff_blockouts enable row level security;
alter table public.service_appointments enable row level security;
alter table public.service_appointment_status_events enable row level security;
revoke all on table public.service_categories, public.service_profiles, public.service_staff, public.service_offerings, public.service_staff_offerings, public.service_staff_availability, public.service_staff_blockouts, public.service_appointments, public.service_appointment_status_events from anon, authenticated;
grant all on table public.service_categories, public.service_profiles, public.service_staff, public.service_offerings, public.service_staff_offerings, public.service_staff_availability, public.service_staff_blockouts, public.service_appointments, public.service_appointment_status_events to service_role;

create or replace function public.create_service_appointment(p_service_profile_id uuid,p_offering_id uuid,p_staff_id uuid,p_customer_user_id uuid,p_customer_name text,p_customer_email text,p_customer_phone text,p_starts_at timestamptz,p_customer_notes text default null) returns public.service_appointments
language plpgsql security definer set search_path = public as $$
declare v_offering public.service_offerings; v_profile public.service_profiles; v_staff public.service_staff; v_appointment public.service_appointments; v_ends_at timestamptz;
begin
select * into v_profile from public.service_profiles where id=p_service_profile_id and status='active' and booking_status='open'; if not found then raise exception 'service_not_bookable'; end if;
select * into v_offering from public.service_offerings where id=p_offering_id and service_profile_id=p_service_profile_id and status='active'; if not found then raise exception 'service_not_bookable'; end if;
select * into v_staff from public.service_staff where id=p_staff_id and service_profile_id=p_service_profile_id and status='active'; if not found then raise exception 'staff_not_bookable'; end if;
if not exists(select 1 from public.service_staff_offerings where staff_id=p_staff_id and offering_id=p_offering_id) then raise exception 'staff_cannot_perform_service'; end if;
v_ends_at := p_starts_at + make_interval(mins=>v_offering.duration_minutes);
if p_starts_at < now()+make_interval(mins=>v_profile.booking_notice_minutes) then raise exception 'booking_notice_violation'; end if;
if p_starts_at > now()+make_interval(days=>v_profile.max_booking_days) then raise exception 'booking_window_violation'; end if;
if exists(select 1 from public.service_staff_blockouts where staff_id=p_staff_id and starts_at<v_ends_at and ends_at>p_starts_at) then raise exception 'staff_unavailable'; end if;
insert into public.service_appointments(public_id,service_profile_id,offering_id,staff_id,customer_user_id,customer_name,customer_email,customer_phone,starts_at,ends_at,status,customer_notes,price,currency)
values('spa_'||replace(gen_random_uuid()::text,'-',''),p_service_profile_id,p_offering_id,p_staff_id,p_customer_user_id,p_customer_name,p_customer_email,p_customer_phone,p_starts_at,v_ends_at,case when v_offering.requires_confirmation then 'pending' else 'confirmed' end,p_customer_notes,v_offering.price,v_offering.currency) returning * into v_appointment;
insert into public.service_appointment_status_events(appointment_id,from_status,to_status,actor_type,actor_user_id) values(v_appointment.id,null,v_appointment.status,case when p_customer_user_id is null then 'system' else 'customer' end,p_customer_user_id);
return v_appointment;
exception when exclusion_violation then raise exception 'slot_unavailable';
end; $$;
revoke all on function public.create_service_appointment(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.create_service_appointment(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text) to service_role;
