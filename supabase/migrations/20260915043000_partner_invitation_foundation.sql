create table if not exists public.partner_invitations (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  partner_type text not null,
  contact_email text,
  whatsapp_phone text,
  channel text not null check (channel in ('email','whatsapp','both')),
  status text not null default 'draft' check (status in ('draft','ready_for_approval','approved','sent','opened','signup_started','onboarding','active','declined','failed')),
  invitation_token uuid not null default gen_random_uuid() unique,
  ai_subject text,
  ai_message text,
  approved_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  signup_started_at timestamptz,
  onboarded_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_invitation_contact check (contact_email is not null or whatsapp_phone is not null)
);
create index if not exists partner_invitations_status_idx on public.partner_invitations(status,created_at desc);
create index if not exists partner_invitations_token_idx on public.partner_invitations(invitation_token);
alter table public.partner_invitations enable row level security;
revoke all on public.partner_invitations from anon, authenticated;
grant select, insert, update, delete on public.partner_invitations to service_role;
comment on table public.partner_invitations is 'Admin-governed partner recruitment invitations. AI drafts only; sending requires explicit approval. WhatsApp delivery must use a configured real provider.';
