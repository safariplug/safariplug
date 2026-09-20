create index if not exists partner_invitations_created_by_idx
on public.partner_invitations (created_by)
where created_by is not null;

create index if not exists partner_invitations_onboarded_user_id_idx
on public.partner_invitations (onboarded_user_id)
where onboarded_user_id is not null;

create index if not exists service_staff_claim_tokens_created_by_idx
on public.service_staff_claim_tokens (created_by);
