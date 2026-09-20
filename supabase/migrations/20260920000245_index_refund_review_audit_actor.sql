create index if not exists travel_refund_review_events_actor_idx
  on public.travel_refund_review_events(actor_user_id)
  where actor_user_id is not null;
