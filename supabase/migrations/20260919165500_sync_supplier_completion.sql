-- Keep supplier_accounts.completion_percent synchronized with the canonical
-- supplier_completion() calculation regardless of whether edits come through
-- the supplier API or direct owner RLS updates.

create or replace function public.sync_supplier_completion_from_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completion integer;
begin
  v_completion := public.supplier_completion(new.id);

  update public.supplier_accounts
  set completion_percent = v_completion,
      updated_at = now()
  where business_id = new.id
    and completion_percent is distinct from v_completion;

  return new;
end;
$$;

revoke execute on function public.sync_supplier_completion_from_business()
from public, anon, authenticated;
grant execute on function public.sync_supplier_completion_from_business()
to service_role;

drop trigger if exists businesses_sync_supplier_completion on public.businesses;
create trigger businesses_sync_supplier_completion
after insert or update of
  name,
  description,
  phone,
  email,
  address,
  website_url,
  logo_url,
  cover_image_url,
  supplier_gallery_urls
on public.businesses
for each row execute function public.sync_supplier_completion_from_business();

create or replace function public.sync_supplier_completion_from_service_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_previous_business_id uuid;
  v_completion integer;
begin
  if tg_op = 'DELETE' then
    v_business_id := old.business_id;
  else
    v_business_id := new.business_id;
  end if;

  if v_business_id is not null then
    v_completion := public.supplier_completion(v_business_id);
    update public.supplier_accounts
    set completion_percent = v_completion,
        updated_at = now()
    where business_id = v_business_id
      and completion_percent is distinct from v_completion;
  end if;

  if tg_op = 'UPDATE' and old.business_id is distinct from new.business_id then
    v_previous_business_id := old.business_id;
    if v_previous_business_id is not null then
      v_completion := public.supplier_completion(v_previous_business_id);
      update public.supplier_accounts
      set completion_percent = v_completion,
          updated_at = now()
      where business_id = v_previous_business_id
        and completion_percent is distinct from v_completion;
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function public.sync_supplier_completion_from_service_profile()
from public, anon, authenticated;
grant execute on function public.sync_supplier_completion_from_service_profile()
to service_role;

drop trigger if exists service_profiles_sync_supplier_completion on public.service_profiles;
create trigger service_profiles_sync_supplier_completion
after insert or delete or update of business_id
on public.service_profiles
for each row execute function public.sync_supplier_completion_from_service_profile();

create or replace function public.set_supplier_completion_on_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.completion_percent := public.supplier_completion(new.business_id);
  return new;
end;
$$;

revoke execute on function public.set_supplier_completion_on_account()
from public, anon, authenticated;
grant execute on function public.set_supplier_completion_on_account()
to service_role;

drop trigger if exists supplier_accounts_set_completion on public.supplier_accounts;
create trigger supplier_accounts_set_completion
before insert or update of business_id
on public.supplier_accounts
for each row execute function public.set_supplier_completion_on_account();

-- Repair any pre-existing stale values.
update public.supplier_accounts sa
set completion_percent = public.supplier_completion(sa.business_id),
    updated_at = now()
where completion_percent is distinct from public.supplier_completion(sa.business_id);
