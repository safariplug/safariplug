-- Prepared supplier onboarding follow-up drafts.
-- These records are staff-review artifacts only. They never send email by themselves.

create table if not exists public.supplier_onboarding_followup_drafts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_accounts(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  message text not null,
  missing_requirements jsonb not null default '[]'::jsonb,
  comparison jsonb,
  status text not null default 'prepared' check (status in ('prepared','used','superseded')),
  prepared_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists supplier_onboarding_followup_drafts_one_prepared_idx
  on public.supplier_onboarding_followup_drafts (supplier_id)
  where status = 'prepared';

create index if not exists supplier_onboarding_followup_drafts_prepared_idx
  on public.supplier_onboarding_followup_drafts (status, prepared_at desc);

alter table public.supplier_onboarding_followup_drafts enable row level security;
