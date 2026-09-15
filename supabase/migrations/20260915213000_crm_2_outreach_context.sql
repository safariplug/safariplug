-- CRM 2.0 Phase 7: preserve CRM context through governed partner outreach.

alter table public.partner_invitations
  add column if not exists prospect_id uuid references public.ai_sales_prospects(id) on delete set null,
  add column if not exists partner_id uuid references public.safari_partners(id) on delete set null,
  add column if not exists contact_id uuid references public.crm_contacts(id) on delete set null;

create index if not exists partner_invitations_prospect_id_idx
  on public.partner_invitations (prospect_id)
  where prospect_id is not null;

create index if not exists partner_invitations_partner_id_idx
  on public.partner_invitations (partner_id)
  where partner_id is not null;

create index if not exists partner_invitations_contact_id_idx
  on public.partner_invitations (contact_id)
  where contact_id is not null;

comment on column public.partner_invitations.prospect_id is 'Optional originating AI sales prospect for governed outreach context.';
comment on column public.partner_invitations.partner_id is 'Optional enrolled SafariPlug partner associated with the invitation.';
comment on column public.partner_invitations.contact_id is 'Optional CRM contact selected by a human for the invitation.';
