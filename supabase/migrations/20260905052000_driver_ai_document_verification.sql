-- AI document verification uses verification_evidence.metadata for non-sensitive workflow metadata.
-- Raw documents remain in the private driver-verification storage bucket.
comment on column public.verification_evidence.metadata is 'Workflow metadata only. AI document verification may store decision, confidence, checks and model metadata; never store identity numbers or raw document contents.';
create index if not exists verification_evidence_case_type_idx on public.verification_evidence(case_id, evidence_type, created_at desc);
