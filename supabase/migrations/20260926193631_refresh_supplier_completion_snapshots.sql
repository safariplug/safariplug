update public.supplier_accounts sa
set completion_percent = public.supplier_completion(sa.business_id),
    updated_at = now()
where sa.business_id is not null
  and sa.completion_percent is distinct from public.supplier_completion(sa.business_id);
