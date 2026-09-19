alter table public.travel_refund_reviews
  drop constraint if exists travel_refund_reviews_product_check;

alter table public.travel_refund_reviews
  add constraint travel_refund_reviews_product_check
  check (product in ('hotel','transfer','activity','service','food'));

comment on table public.travel_refund_reviews is
  'Server-only finance review workflow for travel, service and food-order cases that may require customer refund/reconciliation review. Review state only; does not move money or alter payment truth.';
