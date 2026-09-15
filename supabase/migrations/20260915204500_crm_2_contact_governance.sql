-- CRM 2.0 Phase 6: contact governance and query support

-- One primary contact per prospect and per enrolled partner.
create unique index if not exists crm_contacts_one_primary_per_prospect_idx
  on public.crm_contacts (prospect_id)
  where is_primary = true and prospect_id is not null;

create unique index if not exists crm_contacts_one_primary_per_partner_idx
  on public.crm_contacts (partner_id)
  where is_primary = true and partner_id is not null;

-- Cover contact foreign keys used by activity/follow-up joins.
create index if not exists crm_activities_contact_id_idx
  on public.crm_activities (contact_id)
  where contact_id is not null;

create index if not exists crm_followups_contact_id_idx
  on public.crm_followups (contact_id)
  where contact_id is not null;
