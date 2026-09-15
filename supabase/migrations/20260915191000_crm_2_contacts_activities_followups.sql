-- SafariPlug CRM 2.0: governed contacts, activity history and follow-up tasks.
-- Admin/service-role workflows own these records; no public policies are introduced here.

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.ai_sales_prospects(id) on delete cascade,
  partner_id uuid references public.safari_partners(id) on delete cascade,
  full_name text not null,
  job_title text,
  email text,
  phone text,
  linkedin_url text,
  is_primary boolean not null default false,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','invalid')),
  source_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (prospect_id is not null or partner_id is not null)
);

create index if not exists crm_contacts_prospect_idx on public.crm_contacts(prospect_id);
create index if not exists crm_contacts_partner_idx on public.crm_contacts(partner_id);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.ai_sales_prospects(id) on delete cascade,
  partner_id uuid references public.safari_partners(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  activity_type text not null check (activity_type in ('research','note','call','email','whatsapp','meeting','stage_change','approval','system')),
  summary text not null,
  details text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (prospect_id is not null or partner_id is not null)
);

create index if not exists crm_activities_prospect_time_idx on public.crm_activities(prospect_id,occurred_at desc);
create index if not exists crm_activities_partner_time_idx on public.crm_activities(partner_id,occurred_at desc);

create table if not exists public.crm_followups (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.ai_sales_prospects(id) on delete cascade,
  partner_id uuid references public.safari_partners(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  title text not null,
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (prospect_id is not null or partner_id is not null)
);

create index if not exists crm_followups_prospect_due_idx on public.crm_followups(prospect_id,status,due_at);
create index if not exists crm_followups_partner_due_idx on public.crm_followups(partner_id,status,due_at);

alter table public.crm_contacts enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_followups enable row level security;
