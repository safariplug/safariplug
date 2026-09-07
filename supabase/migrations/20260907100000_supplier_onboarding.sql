create table if not exists public.supplier_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  contact_name text not null,
  invitation_status text not null default 'pending' check (invitation_status in ('pending','accepted','expired','cancelled')),
  onboarding_status text not null default 'draft' check (onboarding_status in ('draft','submitted','changes_requested','approved','rejected','live')),
  completion_percent integer not null default 0 check (completion_percent between 0 and 100),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supplier_accounts enable row level security;
revoke all on table public.supplier_accounts from anon, authenticated;
grant all on table public.supplier_accounts to service_role;

create index if not exists supplier_accounts_status_idx on public.supplier_accounts(onboarding_status, invitation_status);

alter table public.businesses add column if not exists supplier_contact_name text;
alter table public.businesses add column if not exists supplier_gallery_urls text[] not null default '{}';

insert into storage.buckets (id, name, public) values ('supplier-media','supplier-media',true) on conflict (id) do update set public=true;

create or replace function public.supplier_completion(p_business_id uuid) returns integer
language sql stable security definer set search_path=public as $$
  with b as (select * from public.businesses where id=p_business_id),
  checks as (
    select
      (case when nullif(trim(coalesce(name,'')),'') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(description,'')),'') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(phone,'')),'') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(email,'')),'') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(address,'')),'') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(website_url,'')),'') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(logo_url,'')),'') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(cover_image_url,'')),'') is not null then 1 else 0 end) +
      (case when coalesce(array_length(supplier_gallery_urls,1),0) > 0 then 1 else 0 end) +
      (case when exists(select 1 from public.service_profiles sp where sp.business_id=p_business_id) then 1 else 0 end) as completed,
      10 as total
    from b
  )
  select round(completed * 100.0 / total)::integer from checks;
$$;
revoke all on function public.supplier_completion(uuid) from public, anon, authenticated;
grant execute on function public.supplier_completion(uuid) to service_role;
