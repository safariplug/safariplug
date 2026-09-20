create index if not exists travel_refund_reviews_assigned_to_idx
on public.travel_refund_reviews (assigned_to)
where assigned_to is not null;

create index if not exists travel_refund_reviews_resolved_by_idx
on public.travel_refund_reviews (resolved_by)
where resolved_by is not null;
