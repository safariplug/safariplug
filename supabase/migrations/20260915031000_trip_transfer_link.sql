alter table public.trip_items add column if not exists driver_transfer_request_id uuid references public.driver_transfer_requests(id) on delete set null;
create index if not exists trip_items_driver_transfer_request_idx on public.trip_items(driver_transfer_request_id) where driver_transfer_request_id is not null;
insert into public.inventory_kinds(slug,label,group_name) values ('transfer','Driver transfer','transport') on conflict (slug) do nothing;
