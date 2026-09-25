create or replace function public.service_provider_verification_ready(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.verification_cases vc
    where vc.subject_type = 'provider'
      and vc.subject_id = p_user_id
      and vc.status = 'approved'
      and (vc.expires_at is null or vc.expires_at > now())
      and (
        vc.provider = 'human_review'
        or (
          vc.verification_level in ('identity','enhanced')
          and exists (
            select 1
            from public.verification_evidence ve
            where ve.case_id = vc.id
              and ve.evidence_type = 'identity'
              and ve.status = 'accepted'
              and (ve.expires_at is null or ve.expires_at > now())
          )
          and exists (
            select 1
            from public.verification_evidence ve
            where ve.case_id = vc.id
              and ve.evidence_type = 'liveness'
              and ve.status = 'accepted'
              and (ve.expires_at is null or ve.expires_at > now())
          )
        )
      )
  );
$function$;
