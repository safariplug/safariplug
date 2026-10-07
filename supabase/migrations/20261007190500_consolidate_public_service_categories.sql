-- Consolidate legacy duplicate service categories reported in public navigation.
-- Re-point dependent service_profiles before removing the duplicate row.

do $$
declare
  canonical_id uuid;
  legacy_id uuid;
begin
  select id into canonical_id
  from public.service_categories
  where lower(name) = lower('Fitness & Personal Training')
  limit 1;

  select id into legacy_id
  from public.service_categories
  where lower(name) = lower('Fitness')
  limit 1;

  if canonical_id is not null and legacy_id is not null and canonical_id <> legacy_id then
    update public.service_profiles set category_id = canonical_id where category_id = legacy_id;
    delete from public.service_categories where id = legacy_id;
  elsif canonical_id is null and legacy_id is not null then
    update public.service_categories
      set name = 'Fitness & Personal Training',
          slug = 'fitness-personal-training'
    where id = legacy_id;
  end if;

  canonical_id := null;
  legacy_id := null;

  select id into canonical_id
  from public.service_categories
  where lower(name) = lower('Photography & Content')
  limit 1;

  select id into legacy_id
  from public.service_categories
  where lower(name) = lower('Photography')
  limit 1;

  if canonical_id is not null and legacy_id is not null and canonical_id <> legacy_id then
    update public.service_profiles set category_id = canonical_id where category_id = legacy_id;
    delete from public.service_categories where id = legacy_id;
  elsif canonical_id is null and legacy_id is not null then
    update public.service_categories
      set name = 'Photography & Content',
          slug = 'photography-content'
    where id = legacy_id;
  end if;
end
$$;
