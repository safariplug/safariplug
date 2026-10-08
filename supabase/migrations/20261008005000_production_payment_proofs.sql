create table if not exists public.production_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  product text not null check (product in ('hotel','activity','transfer','service')),
  source_id uuid not null,
  payment_provider text null,
  payment_reference text not null,
  currency text not null,
  amount numeric not null check (amount >= 0),
  booking_status text not null,
  verified_by uuid not null references auth.users(id) on delete restrict,
  verified_at timestamptz not null default now(),
  notes text null,
  evidence_summary jsonb not null default '{}'::jsonb,
  unique (product,source_id)
);

create index if not exists production_payment_proofs_verified_idx on public.production_payment_proofs (verified_at desc);
alter table public.production_payment_proofs enable row level security;
drop policy if exists "production_payment_proofs_no_direct_access" on public.production_payment_proofs;
create policy "production_payment_proofs_no_direct_access" on public.production_payment_proofs for all using (false) with check (false);
