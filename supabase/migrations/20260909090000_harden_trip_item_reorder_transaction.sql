create or replace function public.reorder_trip_items(p_trip_id uuid, p_traveler_id uuid, p_item_ids uuid[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected integer;
  v_actual integer;
begin
  if p_item_ids is null or cardinality(p_item_ids) = 0 then
    raise exception 'trip_items_required';
  end if;

  select count(*) into v_expected from unnest(p_item_ids) as x(id);
  select count(distinct id) into v_actual from unnest(p_item_ids) as x(id);
  if v_expected <> v_actual then
    raise exception 'duplicate_trip_item_ids';
  end if;

  perform 1 from public.trips where id = p_trip_id and traveler_id = p_traveler_id for update;
  if not found then
    raise exception 'trip_not_found';
  end if;

  select count(*) into v_actual
  from public.trip_items ti
  where ti.trip_id = p_trip_id and ti.id = any(p_item_ids);
  if v_actual <> v_expected then
    raise exception 'trip_item_not_found';
  end if;

  update public.trip_items ti
  set position = x.position
  from (
    select id, row_number() over () - 1 as position
    from unnest(p_item_ids) as u(id)
  ) x
  where ti.id = x.id and ti.trip_id = p_trip_id;

  update public.trips set updated_at = now() where id = p_trip_id;
  return true;
end;
$$;

revoke all on function public.reorder_trip_items(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_trip_items(uuid, uuid, uuid[]) to service_role;
