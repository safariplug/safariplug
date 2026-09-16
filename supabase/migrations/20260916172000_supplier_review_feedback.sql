alter table public.supplier_accounts
  add column if not exists review_items jsonb not null default '[]'::jsonb,
  add column if not exists review_note text,
  add column if not exists review_requested_at timestamptz;

comment on column public.supplier_accounts.review_items is 'Structured human-requested onboarding fixes shown back to the supplier.';
comment on column public.supplier_accounts.review_note is 'Optional human review note sent with requested onboarding changes.';
comment on column public.supplier_accounts.review_requested_at is 'When SafariPlug staff last requested onboarding changes.';
