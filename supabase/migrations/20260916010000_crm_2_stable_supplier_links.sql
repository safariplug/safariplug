-- CRM 2.0 Phase 8: stable links between enrolled suppliers and CRM records.
-- Nullable by design: legacy/direct supplier enrollments may not originate in AI Sales.

alter table public.supplier_accounts
  add column if not exists prospect_id uuid references public.ai_sales_prospects(id) on delete set null,
  add column if not exists partner_id uuid references public.safari_partners(id) on delete set null;

create unique index if not exists supplier_accounts_prospect_id_unique
  on public.supplier_accounts(prospect_id)
  where prospect_id is not null;

create unique index if not exists supplier_accounts_partner_id_unique
  on public.supplier_accounts(partner_id)
  where partner_id is not null;

comment on column public.supplier_accounts.prospect_id is
  'Stable optional link to the AI Sales prospect that originated this supplier relationship.';

comment on column public.supplier_accounts.partner_id is
  'Stable optional link to the SafariPlug partner CRM relationship for this enrolled supplier.';
