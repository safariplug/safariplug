create or replace function public.service_staff_require_external_verification()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.verification_state = 'verified' then
    if new.user_id is null then
      raise exception 'Verified service specialist requires linked SafariPlug account';
    end if;

    if exists (
      select 1
      from public.verification_cases c
      where c.subject_type = 'service_staff'
        and c.subject_id = new.id
        and c.status = 'approved'
        and c.provider = 'human_review'
        and (c.expires_at is null or c.expires_at > now())
    ) then
      return new;
    end if;

    if new.identity_liveness_verified_at is null then
      raise exception 'Verified service specialist requires identity_liveness_verified_at or approved SafariPlug staff review';
    end if;

    if not exists (
      select 1
      from public.verification_cases c
      where c.subject_type = 'service_staff'
        and c.subject_id = new.id
        and c.status = 'approved'
        and c.provider = 'sumsub'
        and (c.expires_at is null or c.expires_at > now())
        and exists (
          select 1
          from public.verification_evidence e
          where e.case_id = c.id
            and e.evidence_type = 'identity'
            and e.status = 'accepted'
            and e.provider = 'sumsub'
        )
        and exists (
          select 1
          from public.verification_evidence e
          where e.case_id = c.id
            and e.evidence_type = 'liveness'
            and e.status = 'accepted'
            and e.provider = 'sumsub'
        )
    ) then
      raise exception 'Verified service specialist requires approved external identity and liveness evidence or approved SafariPlug staff review';
    end if;
  end if;
  return new;
end;
$function$;
