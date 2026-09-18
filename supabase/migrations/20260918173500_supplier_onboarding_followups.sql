-- Partner 360 supplier onboarding follow-up history.
-- Human-governed: drafts may be AI-assisted, but delivery requires explicit staff approval.

create table if not exists public.supplier_onboarding_followups (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_accounts(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  message text not null,
  missing_requirements jsonb not null default '[]'::jsonb,
  status text not null default 'sent' check (status in ('sent','cancelled')),
  sent_at timestamptz not null default now(),
  next_followup_due_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists supplier_onboarding_followups_supplier_sent_idx
  on public.supplier_onboarding_followups (supplier_id, sent_at desc);

create index if not exists supplier_onboarding_followups_due_idx
  on public.supplier_onboarding_followups (status, next_followup_due_at)
  where next_followup_due_at is not null;

alter table public.supplier_onboarding_followups enable row level security;
