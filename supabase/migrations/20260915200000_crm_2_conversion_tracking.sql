-- SafariPlug CRM 2.0 Phase 5: explicit conversion outcomes.
-- Conversion is recorded by an admin workflow; AI may surface intelligence but does not declare outcomes.

create table if not exists public.crm_conversions (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.ai_sales_prospects(id) on delete cascade,
  partner_id uuid references public.safari_partners(id) on delete cascade,
  outcome text not null check (outcome in ('qualified','meeting_booked','proposal_sent','partnered','lost','disqualified')),
  source text not null default 'human' check (source in ('human','system')),
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (prospect_id is not null or partner_id is not null)
);

create index if not exists crm_conversions_prospect_time_idx on public.crm_conversions(prospect_id,occurred_at desc);
create index if not exists crm_conversions_partner_time_idx on public.crm_conversions(partner_id,occurred_at desc);
create index if not exists crm_conversions_outcome_time_idx on public.crm_conversions(outcome,occurred_at desc);

alter table public.crm_conversions enable row level security;
