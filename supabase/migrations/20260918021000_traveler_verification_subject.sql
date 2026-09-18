alter table public.verification_cases
  drop constraint if exists verification_cases_subject_type_check;

alter table public.verification_cases
  add constraint verification_cases_subject_type_check
  check (
    subject_type = any (
      array[
        'driver'::text,
        'provider'::text,
        'vehicle'::text,
        'local'::text,
        'traveler'::text
      ]
    )
  );

create unique index if not exists verification_cases_open_traveler_idx
  on public.verification_cases(subject_id)
  where subject_type='traveler'
    and status in ('not_started','pending','in_review');
