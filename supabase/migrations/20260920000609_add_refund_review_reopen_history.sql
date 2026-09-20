alter table public.travel_refund_review_events
  drop constraint if exists travel_refund_review_events_event_type_check;

alter table public.travel_refund_review_events
  add constraint travel_refund_review_events_event_type_check
  check (event_type in ('created','review_started','resolved','updated','reopened'));

create or replace function public.capture_travel_refund_review_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_event_type text;
  v_actor uuid;
begin
  if tg_op = 'INSERT' then
    v_event_type := case
      when new.status = 'resolved' then 'resolved'
      when new.status = 'in_review' then 'review_started'
      else 'created'
    end;
    v_actor := coalesce(new.resolved_by, new.assigned_to);

    insert into public.travel_refund_review_events (
      review_id, product, ledger_id, event_type,
      from_status, to_status, from_resolution, to_resolution,
      actor_user_id, notes_snapshot, metadata
    ) values (
      new.id, new.product, new.ledger_id, v_event_type,
      null, new.status, null, new.resolution,
      v_actor, new.notes,
      jsonb_build_object('provider', new.provider, 'reason', new.reason)
    );
    return new;
  end if;

  if (old.status, old.resolution, old.notes, old.assigned_to, old.resolved_by)
     is not distinct from
     (new.status, new.resolution, new.notes, new.assigned_to, new.resolved_by) then
    return new;
  end if;

  v_event_type := case
    when old.status = 'resolved' and new.status = 'in_review' then 'reopened'
    when old.status is distinct from new.status and new.status = 'resolved' then 'resolved'
    when old.status is distinct from new.status and new.status = 'in_review' then 'review_started'
    else 'updated'
  end;
  v_actor := coalesce(new.resolved_by, new.assigned_to, old.resolved_by, old.assigned_to);

  insert into public.travel_refund_review_events (
    review_id, product, ledger_id, event_type,
    from_status, to_status, from_resolution, to_resolution,
    actor_user_id, notes_snapshot, metadata
  ) values (
    new.id, new.product, new.ledger_id, v_event_type,
    old.status, new.status, old.resolution, new.resolution,
    v_actor, new.notes,
    jsonb_build_object('provider', new.provider, 'reason', new.reason)
  );

  return new;
end;
$$;

comment on function public.capture_travel_refund_review_event() is
  'Captures append-only finance review history, including governed reopen/correction transitions.';
