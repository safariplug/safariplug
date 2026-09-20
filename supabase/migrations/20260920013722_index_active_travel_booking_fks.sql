create index if not exists driver_transfer_requests_transfer_rate_id_idx
on public.driver_transfer_requests (transfer_rate_id)
where transfer_rate_id is not null;

create index if not exists driver_transfer_requests_trip_id_idx
on public.driver_transfer_requests (trip_id)
where trip_id is not null;

create index if not exists hotel_checkout_intents_ledger_id_idx
on public.hotel_checkout_intents (ledger_id)
where ledger_id is not null;

create index if not exists trip_package_checkout_attempts_traveler_id_idx
on public.trip_package_checkout_attempts (traveler_id);

create index if not exists trip_package_payment_intents_checkout_attempt_id_idx
on public.trip_package_payment_intents (checkout_attempt_id);

create index if not exists trip_package_payment_intents_quote_id_idx
on public.trip_package_payment_intents (quote_id);

create index if not exists trip_package_quotes_traveler_id_idx
on public.trip_package_quotes (traveler_id);
