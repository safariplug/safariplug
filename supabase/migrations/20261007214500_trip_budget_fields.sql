alter table public.trips
  add column if not exists budget_amount numeric null check (budget_amount is null or budget_amount >= 0),
  add column if not exists budget_currency text null check (budget_currency is null or budget_currency ~ '^[A-Z]{3}$');

create index if not exists trips_budget_currency_idx on public.trips (budget_currency) where budget_currency is not null;
