create or replace function public.supplier_completion(p_business_id uuid)
returns integer
language sql
stable
security definer
set search_path = 'public'
as $$
  with b as (
    select *
    from public.businesses
    where id = p_business_id
  ),
  checks as (
    select
      (case when nullif(trim(coalesce(name,'')),'') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(description,'')),'') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(supplier_contact_name,'')),'') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(phone,'')),'') is not null
               or nullif(trim(coalesce(email,'')),'') is not null
               or nullif(trim(coalesce(whatsapp,'')),'') is not null
            then 1 else 0 end) +
      (case when nullif(trim(coalesce(address,'')),'') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(business_type,'')),'') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(logo_url,'')),'') is not null
               or nullif(trim(coalesce(cover_image_url,'')),'') is not null
               or coalesce(array_length(supplier_gallery_urls,1),0) > 0
            then 1 else 0 end) +
      (case
         when lower(trim(coalesce(business_type,''))) in ('restaurant','hotel','event organizer') then 1
         when exists(
           select 1
           from public.service_profiles sp
           where sp.business_id = p_business_id
         ) then 1
         else 0
       end) as completed,
      8 as total
    from b
  )
  select coalesce(round(completed * 100.0 / total)::integer, 0)
  from checks;
$$;

update public.supplier_accounts sa
set completion_percent = public.supplier_completion(sa.business_id),
    updated_at = now()
where sa.business_id is not null
  and sa.completion_percent is distinct from public.supplier_completion(sa.business_id);

revoke all on function public.supplier_completion(uuid) from public, anon, authenticated;
grant execute on function public.supplier_completion(uuid) to service_role;
