create table if not exists public.travel_refund_review_events (
  id bigint generated always as identity primary key,
  review_id uuid not null references public.travel_refund_reviews(id) on delete restrict,
  product text not null,
  ledger_id uuid not null,
  event_type text not null check (event_type in ('created','review_started','resolved','updated')),
  from_status text,
  to_status text not null,
  from_resolution text,
  to_resolution text,
  actor_user_id uuid references auth.users(id) on delete set null,
  notes_snapshot text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists travel_refund_review_events_review_idx
  on public.travel_refund_review_events(review_id, id desc);

alter table public.travel_refund_review_events enable row level security;
revoke all on table public.travel_refund_review_events from anon, authenticated;
grant select, insert on table public.travel_refund_review_events to service_role;
revoke update, delete, truncate on table public.travel_refund_review_events from service_role;

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
    when old.status is distinct from new.status and new.status = 'resolved' then 'resolved'
    when old.status is distinct from new.status and new.status = 'in_review' then 'review_started'
    else 'updated'
  end;
  v_actor := coalesce(new.resolved_by, new.assigned_to, old.assigned_to);

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

revoke all on function public.capture_travel_refund_review_event() from public, anon, authenticated;
grant execute on function public.capture_travel_refund_review_event() to service_role;

drop trigger if exists travel_refund_review_audit_trigger on public.travel_refund_reviews;
create trigger travel_refund_review_audit_trigger
after insert or update on public.travel_refund_reviews
for each row execute function public.capture_travel_refund_review_event();

comment on table public.travel_refund_review_events is
  'Append-only server-side event history for governed refund/reconciliation review decisions. This table records review state changes only and never moves money.';

comment on function public.capture_travel_refund_review_event() is
  'Captures append-only finance review history after travel_refund_reviews insert/update operations.';
