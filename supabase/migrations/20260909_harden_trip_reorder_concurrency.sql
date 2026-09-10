drop function if exists public.reorder_trip_items(uuid,uuid,uuid[]);

create function public.reorder_trip_items(p_trip_id uuid, p_traveler_id uuid, p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_id uuid;
  v_position integer := 0;
  v_count integer;
  v_trip_id uuid;
begin
  select t.id into v_trip_id
  from public.trips t
  where t.id = p_trip_id and t.traveler_id = p_traveler_id
  for update;

  if v_trip_id is null then raise exception 'trip_not_found'; end if;
  if coalesce(array_length(p_item_ids,1),0)=0 then raise exception 'items_required'; end if;

  select count(*) into v_count from unnest(p_item_ids) x;
  if v_count <> (select count(distinct x) from unnest(p_item_ids) x) then
    raise exception 'duplicate_item_ids';
  end if;

  if (select count(*) from public.trip_items ti where ti.trip_id=p_trip_id and ti.id=any(p_item_ids)) <> v_count then
    raise exception 'item_not_in_trip';
  end if;

  for v_item_id in select x from unnest(p_item_ids) x order by x loop
    perform 1 from public.trip_items ti where ti.id=v_item_id and ti.trip_id=p_trip_id for update;
  end loop;

  update public.trip_items ti
  set position = s.position
  from (
    select x as id, row_number() over () - 1 as position
    from unnest(p_item_ids) x
  ) s
  where ti.id=s.id and ti.trip_id=p_trip_id;

  update public.trips set updated_at=now() where id=p_trip_id and traveler_id=p_traveler_id;
end;
$$;

revoke all on function public.reorder_trip_items(uuid,uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_trip_items(uuid,uuid,uuid[]) to service_role;
