


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."activate_supplier_after_review"("p_supplier_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_business_id uuid;
  v_now timestamptz := now();
begin
  select business_id
  into v_business_id
  from public.supplier_accounts
  where id = p_supplier_id
    and onboarding_status in ('submitted','changes_requested')
  for update;

  if v_business_id is null then
    raise exception 'Supplier is not awaiting review';
  end if;

  update public.service_profiles
  set status = 'active',
      booking_status = 'open'
  where business_id = v_business_id;

  update public.service_offerings so
  set status = 'active'
  from public.service_profiles sp
  where sp.id = so.service_profile_id
    and sp.business_id = v_business_id
    and so.status = 'draft';

  insert into public.service_staff_offerings(staff_id, offering_id)
  select ss.id, so.id
  from public.service_profiles sp
  join public.service_staff ss
    on ss.service_profile_id = sp.id
   and ss.status = 'active'
  join public.service_offerings so
    on so.service_profile_id = sp.id
   and so.status = 'active'
  where sp.business_id = v_business_id
  on conflict (staff_id, offering_id) do nothing;

  update public.businesses
  set status = 'active',
      updated_at = v_now
  where id = v_business_id;

  update public.supplier_accounts
  set onboarding_status = 'approved',
      approved_at = v_now,
      review_items = '[]'::jsonb,
      review_note = null,
      review_requested_at = null,
      updated_at = v_now
  where id = p_supplier_id;
end;
$$;


ALTER FUNCTION "public"."activate_supplier_after_review"("p_supplier_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."activate_supplier_after_review"("p_supplier_id" "uuid") IS 'Server-only atomic supplier activation. Application code must pass the canonical readiness gate before calling this function.';



CREATE OR REPLACE FUNCTION "public"."apply_driver_verification_state"("p_driver_id" "uuid", "p_state" "text", "p_case_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_state not in ('unverified','pending','verified','rejected') then raise exception 'Invalid verification_state'; end if;
  if p_state = 'verified' then
    if not exists (select 1 from public.verification_cases c where c.id = p_case_id and c.subject_type = 'driver' and c.subject_id = p_driver_id and c.status = 'approved' and (c.expires_at is null or c.expires_at > now())) then
      raise exception 'Approved verification case required';
    end if;
  end if;
  update public.driver_profiles set verification_state = p_state, updated_at = now() where id = p_driver_id;
end;
$$;


ALTER FUNCTION "public"."apply_driver_verification_state"("p_driver_id" "uuid", "p_state" "text", "p_case_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."service_appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "public_id" "text" NOT NULL,
    "service_profile_id" "uuid" NOT NULL,
    "offering_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "customer_user_id" "uuid",
    "customer_name" "text" NOT NULL,
    "customer_email" "text",
    "customer_phone" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "customer_notes" "text",
    "provider_notes" "text",
    "price" numeric(12,2) NOT NULL,
    "currency" "text" NOT NULL,
    "cancellation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_fee_percent" numeric(5,2) DEFAULT 10.00 NOT NULL,
    "service_fee_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "provider_net_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "payment_reference" "text",
    "paid_at" timestamp with time zone,
    "service_fee_minimum" numeric(12,2) DEFAULT 30.00 NOT NULL,
    "customer_fee_percent" numeric(5,2) DEFAULT 0.00 NOT NULL,
    "customer_fee_amount" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "customer_total_amount" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "payout_minimum" numeric(12,2) DEFAULT 1000.00 NOT NULL,
    "trip_id" "uuid",
    CONSTRAINT "service_appointments_check" CHECK (("ends_at" > "starts_at")),
    CONSTRAINT "service_appointments_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'pending'::"text", 'paid'::"text", 'partially_refunded'::"text", 'refunded'::"text", 'failed'::"text", 'disputed'::"text"]))),
    CONSTRAINT "service_appointments_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "service_appointments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'checked_in'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text", 'no_show'::"text"])))
);


ALTER TABLE "public"."service_appointments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_service_payment_webhook"("p_appointment_id" "uuid", "p_payment_reference" "text", "p_status" "text", "p_paid_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_refunded_amount" numeric DEFAULT 0) RETURNS "public"."service_appointments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  a public.service_appointments;
  next_status text;
begin
  if p_status not in ('unpaid','pending','paid','partially_refunded','refunded','failed','disputed') then
    raise exception 'invalid_payment_status';
  end if;

  select * into a
  from public.service_appointments
  where id = p_appointment_id
  for update;
  if not found then raise exception 'appointment_not_found'; end if;

  if a.status = 'cancelled' and p_status in ('paid','partially_refunded','refunded') then
    if a.payment_status in ('paid','partially_refunded','refunded','disputed') then
      return a;
    end if;

    next_status := 'disputed';

    update public.service_appointments
    set payment_status = next_status,
        payment_reference = coalesce(nullif(trim(p_payment_reference),''), payment_reference),
        updated_at = now()
    where id = a.id
    returning * into a;

    update public.service_payment_ledger
    set payment_reference = a.payment_reference,
        status = a.payment_status,
        refunded_amount = greatest(0, least(coalesce(p_refunded_amount,0), gross_amount)),
        updated_at = now()
    where appointment_id = a.id;

    return a;
  end if;

  if a.payment_status in ('paid','partially_refunded','refunded','disputed')
     and p_status in ('unpaid','pending','failed') then
    return a;
  end if;

  next_status := p_status;

  update public.service_appointments
  set payment_status = next_status,
      payment_reference = coalesce(nullif(trim(p_payment_reference),''), payment_reference),
      paid_at = case
        when next_status in ('paid','partially_refunded','refunded') then coalesce(p_paid_at, paid_at, now())
        when next_status = 'disputed' and p_paid_at is not null then coalesce(paid_at, p_paid_at)
        else paid_at
      end,
      updated_at = now()
  where id = a.id
  returning * into a;

  update public.service_payment_ledger
  set payment_reference = a.payment_reference,
      status = a.payment_status,
      paid_at = a.paid_at,
      refunded_amount = greatest(0, least(coalesce(p_refunded_amount,0), gross_amount)),
      updated_at = now()
  where appointment_id = a.id;

  return a;
end;
$$;


ALTER FUNCTION "public"."apply_service_payment_webhook"("p_appointment_id" "uuid", "p_payment_reference" "text", "p_status" "text", "p_paid_at" timestamp with time zone, "p_refunded_amount" numeric) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_provider_payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "service_profile_id" "uuid" NOT NULL,
    "provider_user_id" "uuid",
    "currency" "text" NOT NULL,
    "gross_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "platform_fee_percent" numeric(5,2) DEFAULT 10.00 NOT NULL,
    "platform_fee_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "processor_fee_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "refund_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "provider_net_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payout_provider" "text",
    "payout_reference" "text",
    "eligible_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "failure_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider_phone" "text",
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "processing_at" timestamp with time zone,
    "conversation_id" "text",
    "originator_conversation_id" "text",
    "result_code" "text",
    "result_description" "text",
    "payout_destination_phone" "text",
    "payout_destination_verified_at" timestamp with time zone,
    "mpesa_conversation_id" "text",
    "mpesa_result_code" integer,
    "mpesa_result_description" "text",
    "mpesa_transaction_id" "text",
    "payout_phone" "text",
    "payout_phone_verified_at" timestamp with time zone,
    "payout_phone_verified_by" "uuid",
    "approval_user_id" "uuid",
    "transaction_receipt" "text",
    "payout_minimum" numeric(12,2) DEFAULT 1000.00 NOT NULL,
    CONSTRAINT "service_provider_payouts_gross_amount_check" CHECK (("gross_amount" >= (0)::numeric)),
    CONSTRAINT "service_provider_payouts_platform_fee_amount_check" CHECK (("platform_fee_amount" >= (0)::numeric)),
    CONSTRAINT "service_provider_payouts_platform_fee_percent_check" CHECK ((("platform_fee_percent" >= (0)::numeric) AND ("platform_fee_percent" <= (100)::numeric))),
    CONSTRAINT "service_provider_payouts_processor_fee_amount_check" CHECK (("processor_fee_amount" >= (0)::numeric)),
    CONSTRAINT "service_provider_payouts_provider_net_amount_check" CHECK (("provider_net_amount" >= (0)::numeric)),
    CONSTRAINT "service_provider_payouts_refund_amount_check" CHECK (("refund_amount" >= (0)::numeric)),
    CONSTRAINT "service_provider_payouts_status_check" CHECK (("status" = ANY (ARRAY['eligible'::"text", 'approved'::"text", 'processing'::"text", 'paid'::"text", 'failed'::"text", 'held'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."service_provider_payouts" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_service_provider_payout_result"("payout_id" "uuid", "p_status" "text", "p_reference" "text", "p_conversation_id" "text", "p_result_code" "text", "p_result_description" "text") RETURNS "public"."service_provider_payouts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare p public.service_provider_payouts;
begin
 if p_status not in ('paid','failed') then raise exception 'invalid_payout_result'; end if;
 update public.service_provider_payouts set status=p_status, payout_reference=coalesce(p_reference,payout_reference), conversation_id=coalesce(p_conversation_id,conversation_id), result_code=p_result_code, result_description=p_result_description, paid_at=case when p_status='paid' then coalesce(paid_at,now()) else paid_at end, failure_reason=case when p_status='failed' then p_result_description else null end, updated_at=now() where id=payout_id returning * into p;
 if not found then raise exception 'payout_not_found'; end if;
 return p;
end; $$;


ALTER FUNCTION "public"."apply_service_provider_payout_result"("payout_id" "uuid", "p_status" "text", "p_reference" "text", "p_conversation_id" "text", "p_result_code" "text", "p_result_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_service_provider_payout_result"("p_payout_id" "uuid", "p_result_code" integer, "p_result_description" "text", "p_conversation_id" "text", "p_transaction_receipt" "text", "p_succeeded" boolean, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."service_provider_payouts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ declare r public.service_provider_payouts; begin update public.service_provider_payouts set status=case when p_succeeded then 'paid' else 'failed' end, paid_at=case when p_succeeded then coalesce(paid_at,now()) else null end, result_code=p_result_code, result_description=p_result_description, conversation_id=coalesce(p_conversation_id,conversation_id), transaction_receipt=coalesce(p_transaction_receipt,transaction_receipt), payout_reference=coalesce(p_transaction_receipt,payout_reference), failure_reason=case when p_succeeded then null else coalesce(p_result_description,'M-Pesa payout failed') end, metadata=coalesce(metadata,'{}'::jsonb) || coalesce(p_metadata,'{}'::jsonb), updated_at=now() where id=p_payout_id and status in ('processing','approved') returning * into r; if not found then select * into r from public.service_provider_payouts where id=p_payout_id; end if; return r; end; $$;


ALTER FUNCTION "public"."apply_service_provider_payout_result"("p_payout_id" "uuid", "p_result_code" integer, "p_result_description" "text", "p_conversation_id" "text", "p_transaction_receipt" "text", "p_succeeded" boolean, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_service_provider_payout"("p_payout_id" "uuid") RETURNS "public"."service_provider_payouts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ declare r public.service_provider_payouts; begin update public.service_provider_payouts set status='approved', approved_at=coalesce(approved_at,now()), eligible_at=coalesce(eligible_at,now()), updated_at=now() where id=p_payout_id and status='eligible' returning * into r; if not found then raise exception 'payout_not_eligible'; end if; return r; end; $$;


ALTER FUNCTION "public"."approve_service_provider_payout"("p_payout_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_service_provider_payout_as_admin"("p_payout_id" "uuid", "p_admin_user_id" "uuid") RETURNS "public"."service_provider_payouts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  r public.service_provider_payouts;
begin
  if not exists (
    select 1
    from public.admin_users au
    where au.user_id = p_admin_user_id
      and au.role in ('super_admin','finance_manager')
  ) then
    raise exception 'finance_admin_required';
  end if;

  update public.service_provider_payouts
  set
    status = 'approved',
    approved_at = coalesce(approved_at, now()),
    eligible_at = coalesce(eligible_at, now()),
    approved_by = p_admin_user_id,
    approval_user_id = p_admin_user_id,
    updated_at = now()
  where id = p_payout_id
    and status = 'eligible'
  returning * into r;

  if not found then
    raise exception 'payout_not_eligible';
  end if;

  return r;
end;
$$;


ALTER FUNCTION "public"."approve_service_provider_payout_as_admin"("p_payout_id" "uuid", "p_admin_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."approve_service_provider_payout_as_admin"("p_payout_id" "uuid", "p_admin_user_id" "uuid") IS 'Atomically approves an eligible provider payout and records the authorized finance admin in approved_by and approval_user_id.';



CREATE TABLE IF NOT EXISTS "public"."trip_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "offering_id" "uuid",
    "event_id" "uuid",
    "booking_id" "uuid",
    "item_kind" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text",
    "city_id" "uuid",
    "appointment_id" "uuid",
    "food_order_id" "uuid",
    "hotel_booking_pricing_ledger_id" "uuid",
    "local_request_id" "uuid",
    "driver_transfer_request_id" "uuid"
);


ALTER TABLE "public"."trip_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."trip_items" IS 'Trip graph items. Attaching an approved event does not make it bookable.';



CREATE OR REPLACE FUNCTION "public"."attach_service_appointment_to_trip"("p_appointment_id" "uuid", "p_trip_id" "uuid", "p_traveler_id" "uuid") RETURNS "public"."trip_items"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_appointment public.service_appointments;
  v_trip public.trips;
  v_item public.trip_items;
  v_position integer;
begin
  select * into v_trip from public.trips where id = p_trip_id and traveler_id = p_traveler_id for update;
  if not found then raise exception 'trip_not_found'; end if;
  select * into v_appointment from public.service_appointments where id = p_appointment_id and customer_user_id = p_traveler_id for update;
  if not found then raise exception 'appointment_not_found'; end if;
  if v_appointment.trip_id is not null and v_appointment.trip_id <> p_trip_id then raise exception 'appointment_already_in_trip'; end if;
  select * into v_item from public.trip_items where appointment_id = p_appointment_id for update;
  if found and v_item.trip_id <> p_trip_id then raise exception 'appointment_already_in_trip'; end if;
  if found then return v_item; end if;
  select coalesce(max(position), -1) + 1 into v_position from public.trip_items where trip_id = p_trip_id;
  insert into public.trip_items (trip_id, appointment_id, item_kind, title, start_at, end_at, position)
  values (p_trip_id, p_appointment_id, 'service', 'Service appointment', v_appointment.starts_at, v_appointment.ends_at, v_position)
  returning * into v_item;
  update public.service_appointments set trip_id = p_trip_id, updated_at = now() where id = p_appointment_id;
  return v_item;
end;
$$;


ALTER FUNCTION "public"."attach_service_appointment_to_trip"("p_appointment_id" "uuid", "p_trip_id" "uuid", "p_traveler_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_service_provider_fee"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  fee_pct numeric(5,2);
  fee_min numeric(12,2);
  customer_pct numeric(5,2);
  customer_min numeric(12,2);
  customer_max numeric(12,2);
  gross numeric(12,2);
  customer_fee numeric(12,2);
  platform_fee numeric(12,2);
  payout_min numeric(12,2);
begin
  select coalesce(service_fee_percent,10.00), coalesce(service_fee_minimum,30.00), coalesce(customer_fee_percent,0), coalesce(customer_fee_minimum,0), coalesce(customer_fee_maximum,0), coalesce(payout_minimum,1000)
    into fee_pct, fee_min, customer_pct, customer_min, customer_max, payout_min
  from public.service_profiles where id = new.service_profile_id;
  gross := greatest(coalesce(new.price,0),0);
  platform_fee := least(gross, greatest(round(gross * fee_pct / 100,2), fee_min));
  customer_fee := greatest(round(gross * customer_pct / 100,2), customer_min);
  if customer_max > 0 then customer_fee := least(customer_fee, customer_max); end if;
  customer_fee := least(customer_fee, gross);
  new.service_fee_percent := fee_pct;
  new.service_fee_minimum := fee_min;
  new.service_fee_amount := platform_fee;
  new.customer_fee_percent := customer_pct;
  new.customer_fee_amount := customer_fee;
  new.customer_total_amount := round(gross + customer_fee,2);
  new.payout_minimum := payout_min;
  new.provider_net_amount := round(gross - platform_fee,2);
  return new;
end; $$;


ALTER FUNCTION "public"."calculate_service_provider_fee"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_transfer_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "traveler_id" "uuid" NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "transfer_rate_id" "uuid",
    "trip_id" "uuid",
    "pickup_label" "text" NOT NULL,
    "destination_label" "text" NOT NULL,
    "requested_at" timestamp with time zone NOT NULL,
    "passenger_count" integer DEFAULT 1 NOT NULL,
    "notes" "text",
    "quoted_amount" numeric(12,2),
    "currency" "text" DEFAULT 'KES'::"text" NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "driver_transfer_requests_passenger_count_check" CHECK ((("passenger_count" > 0) AND ("passenger_count" <= 50))),
    CONSTRAINT "driver_transfer_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'accepted'::"text", 'declined'::"text", 'cancelled'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."driver_transfer_requests" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_driver_transfer_request"("p_request_id" "uuid") RETURNS "public"."driver_transfer_requests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_request public.driver_transfer_requests;
begin
 select * into v_request from public.driver_transfer_requests where id=p_request_id and traveler_id=auth.uid() for update;
 if v_request.id is null then raise exception 'request_not_found'; end if;
 if v_request.status <> 'requested' then raise exception 'request_not_cancellable'; end if;
 update public.driver_transfer_requests set status='cancelled',updated_at=now() where id=v_request.id returning * into v_request;
 return v_request;
end;$$;


ALTER FUNCTION "public"."cancel_driver_transfer_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_travel_refund_review_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."capture_travel_refund_review_event"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."capture_travel_refund_review_event"() IS 'Captures append-only finance review history, including governed reopen/correction transitions.';



CREATE OR REPLACE FUNCTION "public"."claim_next_ai_scout_job"() RETURNS TABLE("id" "uuid", "location" "text", "category" "text", "attempt_count" integer, "max_attempts" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('safariplug_ai_scout_claim'));

  return query
  with candidate as (
    select r.id
    from public.ai_scout_runs r
    where r.status = 'queued'
      and r.queued_at is not null
      and r.queued_at <= now()
      and r.attempt_count < r.max_attempts
      and (
        select count(*)
        from public.ai_scout_runs active
        where active.status = 'running'
          and active.queued_at is not null
      ) < 2
    order by r.queued_at, r.created_at
    for update skip locked
    limit 1
  ), claimed as (
    update public.ai_scout_runs r
    set status = 'running',
        claimed_at = now(),
        started_at = now(),
        attempt_count = r.attempt_count + 1,
        completed_at = null,
        last_error = null,
        poll_lease_until = null
    from candidate c
    where r.id = c.id
    returning r.id, r.location, r.category, r.attempt_count, r.max_attempts
  )
  select * from claimed;
end;
$$;


ALTER FUNCTION "public"."claim_next_ai_scout_job"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_scout_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city" "text" NOT NULL,
    "category" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "queued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "claimed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "provider_response_id" "text",
    "provider_status" "text",
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 3 NOT NULL,
    "qualified_count" integer DEFAULT 0 NOT NULL,
    "contact_ready_count" integer DEFAULT 0 NOT NULL,
    "needs_research_count" integer DEFAULT 0 NOT NULL,
    "inserted_count" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supplier_scout_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."supplier_scout_jobs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_next_supplier_scout_job"() RETURNS SETOF "public"."supplier_scout_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ begin return query with candidate as (select j.id from public.supplier_scout_jobs j where j.status='queued' and j.attempt_count<j.max_attempts order by j.queued_at,j.created_at for update skip locked limit 1) update public.supplier_scout_jobs j set status='running',claimed_at=now(),attempt_count=j.attempt_count+1,last_error=null from candidate c where j.id=c.id returning j.*; end; $$;


ALTER FUNCTION "public"."claim_next_supplier_scout_job"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_service_provider_payout"("p_payout_id" "uuid") RETURNS "public"."service_provider_payouts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r public.service_provider_payouts; v_balance numeric(12,2); v_min numeric(12,2);
begin
  select * into r from public.service_provider_payouts where id=p_payout_id for update;
  if not found then raise exception 'payout_not_found'; end if;
  if r.status <> 'approved' or r.currency <> 'KES' or r.provider_net_amount <= 0 or r.payout_phone is null or r.payout_phone_verified_at is null then raise exception 'payout_not_claimable'; end if;
  v_min := greatest(coalesce(r.payout_minimum,1000),0);
  select coalesce(sum(provider_net_amount),0) into v_balance from public.service_provider_payouts where provider_user_id=r.provider_user_id and currency=r.currency and status in ('eligible','approved','processing') and provider_net_amount > 0;
  if v_balance < v_min then raise exception 'payout_minimum_not_reached'; end if;
  update public.service_provider_payouts set status='processing', processing_at=coalesce(processing_at,now()), updated_at=now() where id=r.id and status='approved' returning * into r;
  return r;
end; $$;


ALTER FUNCTION "public"."claim_service_provider_payout"("p_payout_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_concierge_rate_limit"("p_bucket" "text", "p_limit" integer, "p_window_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r public.concierge_rate_limits%rowtype; now_ts timestamptz := now();
begin
  insert into public.concierge_rate_limits(bucket,window_started_at,request_count,updated_at) values(p_bucket,now_ts,1,now_ts)
  on conflict (bucket) do update set
    request_count = case when public.concierge_rate_limits.window_started_at <= now_ts - make_interval(secs => p_window_seconds) then 1 else public.concierge_rate_limits.request_count + 1 end,
    window_started_at = case when public.concierge_rate_limits.window_started_at <= now_ts - make_interval(secs => p_window_seconds) then now_ts else public.concierge_rate_limits.window_started_at end,
    updated_at = now_ts
  returning * into r;
  return r.request_count <= p_limit;
end; $$;


ALTER FUNCTION "public"."consume_concierge_rate_limit"("p_bucket" "text", "p_limit" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_service_appointment"("p_service_profile_id" "uuid", "p_offering_id" "uuid", "p_staff_id" "uuid", "p_customer_user_id" "uuid", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_starts_at" timestamp with time zone, "p_customer_notes" "text" DEFAULT NULL::"text") RETURNS "public"."service_appointments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_offering public.service_offerings;
  v_profile public.service_profiles;
  v_staff public.service_staff;
  v_appointment public.service_appointments;
  v_ends_at timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_day smallint;
  v_start_time time;
  v_end_time time;
begin
  if p_starts_at is null then raise exception 'booking_time_required'; end if;
  if nullif(trim(coalesce(p_customer_name, '')), '') is null then raise exception 'customer_name_required'; end if;

  select * into v_profile
  from public.service_profiles
  where id = p_service_profile_id and status = 'active' and booking_status = 'open';
  if not found then raise exception 'service_not_bookable'; end if;

  if not exists (
    select 1 from public.businesses
    where id = v_profile.business_id and status = 'active'
  ) then
    raise exception 'service_not_bookable';
  end if;

  select * into v_offering
  from public.service_offerings
  where id = p_offering_id and service_profile_id = p_service_profile_id and status = 'active';
  if not found then raise exception 'service_not_bookable'; end if;

  select * into v_staff
  from public.service_staff
  where id = p_staff_id
    and service_profile_id = p_service_profile_id
    and status = 'active'
    and personal_photo_url is not null
    and user_id is not null
    and verification_state = 'verified'
    and identity_liveness_verified_at is not null;
  if not found then raise exception 'staff_not_bookable'; end if;

  if not exists (
    select 1 from public.service_staff_offerings
    where staff_id = p_staff_id and offering_id = p_offering_id
  ) then raise exception 'staff_cannot_perform_service'; end if;

  v_ends_at := p_starts_at + make_interval(mins => v_offering.duration_minutes);

  if p_starts_at < now() + make_interval(mins => v_profile.booking_notice_minutes) then
    raise exception 'booking_notice_violation';
  end if;
  if p_starts_at > now() + make_interval(days => v_profile.max_booking_days) then
    raise exception 'booking_window_violation';
  end if;

  v_local_start := p_starts_at at time zone v_profile.timezone;
  v_local_end := v_ends_at at time zone v_profile.timezone;
  v_day := extract(dow from v_local_start)::smallint;
  v_start_time := v_local_start::time;
  v_end_time := v_local_end::time;

  if v_local_end::date <> v_local_start::date then
    raise exception 'staff_unavailable';
  end if;

  if not exists (
    select 1
    from public.service_staff_availability sa
    where sa.staff_id = p_staff_id
      and sa.is_active = true
      and sa.day_of_week = v_day
      and sa.start_time <= v_start_time
      and sa.end_time >= v_end_time
  ) then raise exception 'staff_unavailable'; end if;

  if exists (
    select 1 from public.service_staff_blockouts
    where staff_id = p_staff_id and starts_at < v_ends_at and ends_at > p_starts_at
  ) then raise exception 'staff_unavailable'; end if;

  insert into public.service_appointments(
    public_id, service_profile_id, offering_id, staff_id, customer_user_id,
    customer_name, customer_email, customer_phone, starts_at, ends_at, status,
    customer_notes, price, currency
  ) values (
    'spa_' || replace(gen_random_uuid()::text, '-', ''),
    p_service_profile_id, p_offering_id, p_staff_id, p_customer_user_id,
    trim(p_customer_name), nullif(trim(p_customer_email), ''), nullif(trim(p_customer_phone), ''),
    p_starts_at, v_ends_at,
    case when v_offering.requires_confirmation then 'pending' else 'confirmed' end,
    p_customer_notes, v_offering.price, v_offering.currency
  ) returning * into v_appointment;

  insert into public.service_appointment_status_events(
    appointment_id, from_status, to_status, actor_type, actor_user_id
  ) values (
    v_appointment.id, null, v_appointment.status,
    case when p_customer_user_id is null then 'system' else 'customer' end,
    p_customer_user_id
  );

  return v_appointment;
exception
  when exclusion_violation then raise exception 'slot_unavailable';
end;
$$;


ALTER FUNCTION "public"."create_service_appointment"("p_service_profile_id" "uuid", "p_offering_id" "uuid", "p_staff_id" "uuid", "p_customer_user_id" "uuid", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_starts_at" timestamp with time zone, "p_customer_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_service_appointment_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  a record;
  offering_name text;
  business_name text;
  appointment_time text;
  customer_user_id uuid;
  supplier_user_id uuid;
  notification_title text;
  notification_body text;
  notification_type text;
begin
  select sa.*, sp.business_id, sp.timezone, so.name as service_name
    into a
    from public.service_appointments sa
    join public.service_profiles sp on sp.id = sa.service_profile_id
    join public.service_offerings so on so.id = sa.offering_id
   where sa.id = new.appointment_id;

  if not found then return new; end if;

  offering_name := coalesce(a.service_name, 'Appointment');
  select b.name into business_name from public.businesses b where b.id = a.business_id;
  customer_user_id := a.customer_user_id;
  select sa.user_id into supplier_user_id
    from public.supplier_accounts sa
   where sa.business_id = a.business_id
   limit 1;

  appointment_time := to_char(new.created_at at time zone coalesce(a.timezone, 'UTC'), 'Mon DD, YYYY at HH12:MI AM');
  notification_type := 'appointment_' || new.to_status;

  case new.to_status
    when 'confirmed' then notification_title := 'Appointment confirmed'; notification_body := offering_name || ' at ' || coalesce(business_name, 'your provider') || ' is confirmed for ' || appointment_time || '.';
    when 'checked_in' then notification_title := 'You are checked in'; notification_body := 'You have been checked in for ' || offering_name || ' at ' || coalesce(business_name, 'your provider') || '.';
    when 'in_progress' then notification_title := 'Service started'; notification_body := offering_name || ' at ' || coalesce(business_name, 'your provider') || ' has started.';
    when 'completed' then notification_title := 'Appointment completed'; notification_body := offering_name || ' at ' || coalesce(business_name, 'your provider') || ' is complete.';
    when 'cancelled' then notification_title := 'Appointment cancelled'; notification_body := offering_name || ' at ' || coalesce(business_name, 'your provider') || ' has been cancelled.';
    when 'no_show' then notification_title := 'Appointment marked no-show'; notification_body := offering_name || ' at ' || coalesce(business_name, 'your provider') || ' was marked as a no-show.';
    else return new;
  end case;

  if customer_user_id is not null and new.actor_type <> 'customer' then
    insert into public.service_appointment_notifications(user_id, appointment_id, type, title, body)
    values (customer_user_id, new.appointment_id, notification_type, notification_title, notification_body);
  end if;

  if supplier_user_id is not null and new.actor_type <> 'provider' then
    insert into public.service_appointment_notifications(user_id, appointment_id, type, title, body)
    values (supplier_user_id, new.appointment_id, notification_type, notification_title, notification_body);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."create_service_appointment_notifications"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_payment_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "payment_reference" "text",
    "provider_reference" "text",
    "currency" "text" NOT NULL,
    "gross_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "platform_fee_percent" numeric(5,2) DEFAULT 10.00 NOT NULL,
    "platform_fee_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "provider_net_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    "refunded_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_fee_minimum" numeric(12,2) DEFAULT 30.00 NOT NULL,
    "customer_fee_percent" numeric(5,2) DEFAULT 0.00 NOT NULL,
    "customer_fee_amount" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "customer_total_amount" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "payout_minimum" numeric(12,2) DEFAULT 1000.00 NOT NULL,
    CONSTRAINT "service_payment_ledger_check" CHECK ((("refunded_amount" >= (0)::numeric) AND ("refunded_amount" <= "gross_amount"))),
    CONSTRAINT "service_payment_ledger_gross_amount_check" CHECK (("gross_amount" >= (0)::numeric)),
    CONSTRAINT "service_payment_ledger_platform_fee_amount_check" CHECK (("platform_fee_amount" >= (0)::numeric)),
    CONSTRAINT "service_payment_ledger_platform_fee_percent_check" CHECK ((("platform_fee_percent" >= (0)::numeric) AND ("platform_fee_percent" <= (100)::numeric))),
    CONSTRAINT "service_payment_ledger_provider_net_amount_check" CHECK (("provider_net_amount" >= (0)::numeric)),
    CONSTRAINT "service_payment_ledger_status_check" CHECK (("status" = ANY (ARRAY['unpaid'::"text", 'pending'::"text", 'paid'::"text", 'partially_refunded'::"text", 'refunded'::"text", 'failed'::"text", 'disputed'::"text"])))
);


ALTER TABLE "public"."service_payment_ledger" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_service_payment_ledger_entry"("p_appointment_id" "uuid") RETURNS "public"."service_payment_ledger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare result public.service_payment_ledger;
begin
  insert into public.service_payment_ledger(appointment_id,currency,gross_amount,platform_fee_percent,platform_fee_amount,provider_net_amount,status,service_fee_minimum,customer_fee_percent,customer_fee_amount,customer_total_amount,payout_minimum)
  select a.id,a.currency,greatest(coalesce(a.price,0),0),coalesce(a.service_fee_percent,10),greatest(coalesce(a.service_fee_amount,0),0),greatest(coalesce(a.provider_net_amount,0),0),coalesce(a.payment_status,'unpaid'),coalesce(a.service_fee_minimum,30),coalesce(a.customer_fee_percent,0),greatest(coalesce(a.customer_fee_amount,0),0),greatest(coalesce(a.customer_total_amount,a.price),0),coalesce(a.payout_minimum,1000)
  from public.service_appointments a where a.id=p_appointment_id
  on conflict (appointment_id) do update set currency=excluded.currency,gross_amount=excluded.gross_amount,platform_fee_percent=excluded.platform_fee_percent,platform_fee_amount=excluded.platform_fee_amount,provider_net_amount=excluded.provider_net_amount,status=excluded.status,service_fee_minimum=excluded.service_fee_minimum,customer_fee_percent=excluded.customer_fee_percent,customer_fee_amount=excluded.customer_fee_amount,customer_total_amount=excluded.customer_total_amount,payout_minimum=excluded.payout_minimum,updated_at=now()
  returning * into result;
  if result.id is null then raise exception 'appointment_not_found'; end if;
  return result;
end; $$;


ALTER FUNCTION "public"."create_service_payment_ledger_entry"("p_appointment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_service_provider_payout_entry"("p_appointment_id" "uuid") RETURNS "public"."service_provider_payouts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_result public.service_provider_payouts;
  v_payment public.service_payment_ledger;
  v_profile uuid;
  v_owner uuid;
begin
  select * into v_payment from public.service_payment_ledger where appointment_id = p_appointment_id;
  if v_payment.id is null then raise exception 'payment_ledger_not_found'; end if;
  if v_payment.status <> 'paid' then raise exception 'payment_not_paid'; end if;

  select sp.id, b.owner_id into v_profile, v_owner
  from public.service_appointments sa
  join public.service_profiles sp on sp.id = sa.service_profile_id
  join public.businesses b on b.id = sp.business_id
  where sa.id = p_appointment_id;
  if v_profile is null then raise exception 'service_profile_not_found'; end if;

  insert into public.service_provider_payouts(
    appointment_id, service_profile_id, provider_user_id, currency,
    gross_amount, platform_fee_percent, platform_fee_amount,
    provider_net_amount, status, eligible_at
  ) values (
    p_appointment_id, v_profile, v_owner, v_payment.currency,
    v_payment.gross_amount, v_payment.platform_fee_percent, v_payment.platform_fee_amount,
    v_payment.provider_net_amount, 'eligible', now()
  )
  on conflict (appointment_id) do update set
    service_profile_id = excluded.service_profile_id,
    provider_user_id = excluded.provider_user_id,
    currency = excluded.currency,
    gross_amount = excluded.gross_amount,
    platform_fee_percent = excluded.platform_fee_percent,
    platform_fee_amount = excluded.platform_fee_amount,
    provider_net_amount = excluded.provider_net_amount,
    status = case when public.service_provider_payouts.status in ('paid','processing') then public.service_provider_payouts.status else 'eligible' end,
    eligible_at = coalesce(public.service_provider_payouts.eligible_at, now()),
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."create_service_provider_payout_entry"("p_appointment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_service_provider_payout_for_completed_appointment"("p_appointment_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_appointment public.service_appointments%rowtype; v_profile public.service_profiles%rowtype; v_ledger public.service_payment_ledger%rowtype; v_payout_id uuid; v_provider_user_id uuid; v_account public.service_provider_payout_accounts%rowtype;
begin
 select * into v_appointment from public.service_appointments where id=p_appointment_id for update; if not found then raise exception 'appointment_not_found'; end if;
 if v_appointment.status<>'completed' then raise exception 'appointment_not_completed'; end if;
 select * into v_profile from public.service_profiles where id=v_appointment.service_profile_id; if not found then raise exception 'service_profile_not_found'; end if;
 if v_profile.provider_terms_accepted_at is null then raise exception 'provider_terms_required'; end if;
 select * into v_ledger from public.service_payment_ledger where appointment_id=p_appointment_id; if not found or v_ledger.status<>'paid' then raise exception 'payment_not_settled'; end if;
 select id into v_payout_id from public.service_provider_payouts where appointment_id=p_appointment_id; if found then return v_payout_id; end if;
 select owner_id into v_provider_user_id from public.businesses where id=v_profile.business_id;
 select * into v_account from public.service_provider_payout_accounts where provider_user_id=v_provider_user_id and provider='mpesa_b2c';
 insert into public.service_provider_payouts(appointment_id,service_profile_id,provider_user_id,currency,gross_amount,platform_fee_percent,platform_fee_amount,processor_fee_amount,refund_amount,provider_net_amount,status,eligible_at,payout_minimum,payout_destination_phone,payout_destination_verified_at,metadata)
 values(p_appointment_id,v_profile.id,v_provider_user_id,v_ledger.currency,v_ledger.gross_amount,v_ledger.platform_fee_percent,v_ledger.platform_fee_amount,0,v_ledger.refunded_amount,greatest(v_ledger.provider_net_amount-coalesce(v_ledger.refunded_amount,0),0),'eligible',now(),coalesce(v_profile.payout_minimum,1000),case when v_account.status='verified' then v_account.phone else null end,case when v_account.status='verified' then v_account.verified_at else null end,jsonb_build_object('source','completed_appointment')) returning id into v_payout_id;
 return v_payout_id;
end; $$;


ALTER FUNCTION "public"."create_service_provider_payout_for_completed_appointment"("p_appointment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detach_service_appointment_from_trip"("p_item_id" "uuid", "p_trip_id" "uuid", "p_traveler_id" "uuid") RETURNS "public"."trip_items"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_item public.trip_items;
  v_appointment public.service_appointments;
  v_trip public.trips;
begin
  select * into v_trip from public.trips where id = p_trip_id and traveler_id = p_traveler_id for update;
  if not found then raise exception 'trip_not_found'; end if;
  select * into v_item from public.trip_items where id = p_item_id and trip_id = p_trip_id and appointment_id is not null for update;
  if not found then raise exception 'trip_item_not_found'; end if;
  select * into v_appointment from public.service_appointments where id = v_item.appointment_id and customer_user_id = p_traveler_id and trip_id = p_trip_id for update;
  if not found then raise exception 'appointment_not_found'; end if;
  delete from public.trip_items where id = v_item.id;
  update public.service_appointments set trip_id = null, updated_at = now() where id = v_appointment.id;
  return v_item;
end;
$$;


ALTER FUNCTION "public"."detach_service_appointment_from_trip"("p_item_id" "uuid", "p_trip_id" "uuid", "p_traveler_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."driver_assignment_booking_must_exist"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$ begin if not exists (select 1 from public.bookings b where b.id = NEW.booking_id and b.status = any (array['confirmed'::text, 'booked'::text])) then raise exception 'Driver assignment requires a confirmed or booked transfer'; end if; return NEW; end; $$;


ALTER FUNCTION "public"."driver_assignment_booking_must_exist"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."driver_require_activation_compliance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if NEW.service_status = 'active' then
    if NEW.verification_state <> 'verified' then
      raise exception 'Driver cannot become active before verification is approved';
    end if;
    if NEW.driving_license_compliance_status <> 'compliant' then
      raise exception 'Driver cannot become active before license compliance is current';
    end if;
    if not exists (
      select 1
      from public.vehicles v
      where v.driver_id = NEW.id
        and v.status = 'active'
        and v.registration_compliance_status = 'compliant'
        and v.insurance_compliance_status = 'compliant'
    ) then
      raise exception 'Driver cannot become active without an active vehicle with compliant registration and insurance';
    end if;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."driver_require_activation_compliance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."driver_require_approved_verification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.verification_state = 'verified' then
    if not exists (
      select 1
      from public.verification_cases c
      where c.subject_type = 'driver'
        and c.subject_id = new.id
        and c.status = 'approved'
        and c.provider = 'sumsub'
        and (c.expires_at is null or c.expires_at > now())
        and exists (
          select 1 from public.verification_evidence e
          where e.case_id = c.id
            and e.evidence_type = 'identity'
            and e.status = 'accepted'
            and e.provider = 'sumsub'
        )
        and exists (
          select 1 from public.verification_evidence e
          where e.case_id = c.id
            and e.evidence_type = 'liveness'
            and e.status = 'accepted'
            and e.provider = 'sumsub'
        )
    ) then
      raise exception 'Driver verification_state=verified requires approved external identity and liveness evidence';
    end if;

    if new.identity_liveness_verified_at is null then
      raise exception 'Driver verification_state=verified requires identity_liveness_verified_at';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."driver_require_approved_verification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."driver_require_vehicle_compliance_for_active"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  driver_id_value uuid := coalesce(NEW.driver_id, OLD.driver_id);
  driver_status text;
  new_vehicle_eligible boolean := false;
begin
  select dp.service_status into driver_status
  from public.driver_profiles dp
  where dp.id = driver_id_value;

  if driver_status <> 'active' then
    return coalesce(NEW, OLD);
  end if;

  if TG_OP <> 'DELETE' then
    new_vehicle_eligible := NEW.status = 'active'
      and NEW.registration_compliance_status = 'compliant'
      and NEW.insurance_compliance_status = 'compliant';
  end if;

  if not exists (
    select 1
    from public.vehicles v
    where v.driver_id = driver_id_value
      and v.id <> coalesce(NEW.id, OLD.id)
      and v.status = 'active'
      and v.registration_compliance_status = 'compliant'
      and v.insurance_compliance_status = 'compliant'
  ) and not new_vehicle_eligible then
    raise exception 'Active driver must retain at least one active vehicle with compliant registration and insurance';
  end if;
  return coalesce(NEW, OLD);
end;
$$;


ALTER FUNCTION "public"."driver_require_vehicle_compliance_for_active"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_ai_scout_provider_retry_accounting"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_error text;
  v_delay interval;
begin
  if old.status = 'running'
     and old.provider_response_id is not null
     and new.provider_response_id is null
     and new.status in ('queued','failed')
     and new.last_error is not null then

    v_error := lower(new.last_error);
    new.last_provider_error := left(new.last_error, 1000);

    if v_error like '%no credits remaining%'
       or v_error like '%insufficient_quota%'
       or v_error like '%billing%'
       or v_error like '%add credits%' then
      new.provider_failure_count := coalesce(old.provider_failure_count, 0) + 1;
      new.status := 'failed';
      new.worker_stage := 'failed';
      new.attempt_count := greatest(old.attempt_count - 1, 0);
      new.claimed_at := null;
      new.started_at := null;
      new.completed_at := now();
      new.queued_at := old.queued_at;
      new.poll_lease_until := null;
      new.last_error := 'OpenAI API credits exhausted. Add API credits before retrying this Scout mission.';
      new.notes := 'Scout paused by non-retryable OpenAI billing/credit error. Mission attempt preserved; action required before retry.';
      return new;
    end if;

    new.provider_failure_count := coalesce(old.provider_failure_count, 0) + 1;

    if new.provider_failure_count < 5 then
      v_delay := case new.provider_failure_count
        when 1 then interval '1 minute'
        when 2 then interval '3 minutes'
        when 3 then interval '7 minutes'
        else interval '15 minutes'
      end;

      new.status := 'queued';
      new.worker_stage := 'queued';
      new.attempt_count := greatest(old.attempt_count - 1, 0);
      new.claimed_at := null;
      new.started_at := null;
      new.completed_at := null;
      new.queued_at := now() + v_delay;
      new.poll_lease_until := null;
      new.last_error := null;
      new.notes := 'OpenAI provider failure recovered automatically; Scout attempt preserved. Provider retry ' || new.provider_failure_count || '/5 scheduled after backoff.';
    else
      new.status := 'failed';
      new.worker_stage := 'failed';
      new.attempt_count := greatest(old.attempt_count - 1, 0);
      new.completed_at := coalesce(new.completed_at, now());
      new.poll_lease_until := null;
      new.notes := 'OpenAI provider failed repeatedly; provider retry limit 5/5 exhausted. Mission attempt preserved.';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_ai_scout_provider_retry_accounting"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_food_order_payment_lifecycle"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if old.status = 'pending' and new.status in ('accepted','preparing','ready','driver_assigned','picked_up','on_the_way','delivered')
     and new.payment_status not in ('paid','refunded') then
    raise exception using errcode = '23514', message = 'Restaurant order must be paid before fulfillment begins';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_food_order_payment_lifecycle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_service_provider_payout_verification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'processing' AND NOT public.service_provider_verification_ready(NEW.provider_user_id) THEN
    RAISE EXCEPTION 'provider_verification_required';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_service_provider_payout_verification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_service_provider_terms_before_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.booking_status = 'open' then
    if coalesce(new.provider_terms_version,'') <> 'service-provider-terms-v2-2026-09-05' or new.provider_terms_accepted_at is null then
      raise exception 'provider_terms_required';
    end if;
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."enforce_service_provider_terms_before_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_old_events"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.events
  set status = 'expired',
      is_featured = false,
      updated_at = now()
  where status = 'approved'
    and coalesce(end_at, start_at) < now();

  delete from public.ai_discovered_events
  where coalesce(end_at, start_at) < now();
end;
$$;


ALTER FUNCTION "public"."expire_old_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_restaurant_refund"("p_refund_id" "uuid", "p_amount" numeric, "p_refund_reference" "text") RETURNS TABLE("success" boolean, "status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_refund public.food_order_refunds%rowtype;
  v_order public.food_orders%rowtype;
  v_now timestamptz := now();
begin
  select * into v_refund from public.food_order_refunds where id = p_refund_id for update;
  if not found then raise exception 'refund_not_found'; end if;
  if v_refund.provider <> 'mpesa' then raise exception 'unsupported_refund_provider'; end if;
  if round(coalesce(v_refund.amount, 0), 2) <> round(coalesce(p_amount, 0), 2) then raise exception 'refund_amount_mismatch'; end if;
  if v_refund.status = 'succeeded' then return query select true, 'succeeded'::text; return; end if;
  if v_refund.status not in ('pending', 'processing') then return query select false, v_refund.status; return; end if;

  select * into v_order from public.food_orders where id = v_refund.order_id for update;
  if not found then raise exception 'order_not_found'; end if;

  if v_order.payment_status = 'refunded' then
    update public.food_order_refunds set status = 'succeeded', refund_reference = coalesce(nullif(p_refund_reference, ''), refund_reference), updated_at = v_now, processed_at = coalesce(processed_at, v_now), error_message = null where id = v_refund.id;
    update public.food_delivery_assignments set status = 'cancelled', updated_at = v_now, note = 'Order refunded and cancelled' where order_id = v_order.id and status in ('assigned', 'accepted', 'arrived_at_restaurant', 'picked_up', 'on_the_way');
    return query select true, 'succeeded'::text; return;
  end if;

  if v_order.payment_status <> 'paid' then raise exception 'order_not_refundable'; end if;

  update public.food_order_refunds set status = 'succeeded', refund_reference = nullif(p_refund_reference, ''), updated_at = v_now, processed_at = v_now, error_message = null where id = v_refund.id;
  update public.food_orders set payment_status = 'refunded', refunded_amount = v_refund.amount, refund_reference = nullif(p_refund_reference, ''), refunded_at = v_now, status = 'cancelled', cancelled_at = v_now, cancellation_reason = 'Restaurant refund completed', updated_at = v_now where id = v_order.id;
  update public.food_delivery_assignments set status = 'cancelled', updated_at = v_now, note = 'Order refunded and cancelled' where order_id = v_order.id and status in ('assigned', 'accepted', 'arrived_at_restaurant', 'picked_up', 'on_the_way');
  return query select true, 'succeeded'::text;
end;
$$;


ALTER FUNCTION "public"."finalize_restaurant_refund"("p_refund_id" "uuid", "p_amount" numeric, "p_refund_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_completed_service_provider_payouts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select a.id
    from public.service_appointments a
    join public.service_payment_ledger l on l.appointment_id = a.id
    left join public.service_provider_payouts p on p.appointment_id = a.id
    where a.status = 'completed'
      and l.status = 'paid'
      and p.id is null
  loop
    begin
      perform public.create_service_provider_payout_for_completed_appointment(r.id);
      n := n + 1;
    exception when others then
      raise notice 'payout eligibility skipped for %: %', r.id, sqlerrm;
    end;
  end loop;
  return n;
end;
$$;


ALTER FUNCTION "public"."generate_completed_service_provider_payouts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT role FROM public.admin_users WHERE user_id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."get_admin_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hold_service_provider_payout"("p_payout_id" "uuid", "p_reason" "text") RETURNS "public"."service_provider_payouts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v public.service_provider_payouts;
begin
 if coalesce(trim(p_reason),'')='' then raise exception 'hold_reason_required'; end if;
 if not exists (select 1 from public.service_provider_payouts where id=p_payout_id and status in ('eligible','approved')) then raise exception 'payout_not_reviewable'; end if;
 update public.service_provider_payouts set status='held', failure_reason=left(trim(p_reason),1000), updated_at=now() where id=p_payout_id returning * into v;
 return v;
end; $$;


ALTER FUNCTION "public"."hold_service_provider_payout"("p_payout_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_ai_scout_worker"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  worker_token text;
  request_id bigint;
begin
  select decrypted_secret into worker_token
  from vault.decrypted_secrets
  where name = 'ai_scout_worker_token'
  limit 1;

  if worker_token is null then
    raise exception 'AI Scout worker token is not configured';
  end if;

  select net.http_get(
    url := 'https://safariplug.com/api/cron/ai-scout/worker',
    headers := jsonb_build_object('x-scout-worker-token', worker_token, 'Accept', 'application/json'),
    timeout_milliseconds := 15000
  ) into request_id;

  return request_id;
end;
$$;


ALTER FUNCTION "public"."invoke_ai_scout_worker"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_supplier_scout_worker"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare worker_token text; request_id bigint;
begin
 select decrypted_secret into worker_token from vault.decrypted_secrets where name='ai_scout_worker_token' limit 1;
 if worker_token is null then raise exception 'Scout worker token is not configured'; end if;
 select net.http_get(url:='https://safariplug.com/api/cron/supplier-scout/worker',headers:=jsonb_build_object('x-scout-worker-token',worker_token,'Accept','application/json'),timeout_milliseconds:=15000) into request_id;
 return request_id;
end; $$;


ALTER FUNCTION "public"."invoke_supplier_scout_worker"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lease_ai_scout_running_jobs"("p_limit" integer DEFAULT 2, "p_lease_seconds" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "location" "text", "category" "text", "attempt_count" integer, "max_attempts" integer, "provider_response_id" "text", "provider_status" "text", "worker_stage" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return query
  with candidate as (
    select r.id
    from public.ai_scout_runs r
    where r.status = 'running'
      and r.queued_at is not null
      and r.provider_response_id is not null
      and (r.poll_lease_until is null or r.poll_lease_until <= now())
    order by coalesce(r.poll_lease_until, 'epoch'::timestamptz), r.claimed_at, r.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 2), 2))
  ), leased as (
    update public.ai_scout_runs r
    set poll_lease_until = now() + make_interval(secs => greatest(15, least(coalesce(p_lease_seconds, 50), 120)))
    from candidate c
    where r.id = c.id
    returning r.id, r.location, r.category, r.attempt_count, r.max_attempts,
              r.provider_response_id, r.provider_status, r.worker_stage
  )
  select * from leased;
end;
$$;


ALTER FUNCTION "public"."lease_ai_scout_running_jobs"("p_limit" integer, "p_lease_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."local_require_approved_verification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.verification_state='verified' then
    if new.identity_liveness_verified_at is null then
      raise exception 'Local verification_state=verified requires identity_liveness_verified_at';
    end if;

    if not exists (
      select 1
      from public.verification_cases c
      where c.subject_type='local'
        and c.subject_id=new.id
        and c.status='approved'
        and c.provider='sumsub'
        and (c.expires_at is null or c.expires_at > now())
        and exists (
          select 1 from public.verification_evidence e
          where e.case_id=c.id
            and e.evidence_type='identity'
            and e.status='accepted'
            and e.provider='sumsub'
        )
        and exists (
          select 1 from public.verification_evidence e
          where e.case_id=c.id
            and e.evidence_type='liveness'
            and e.status='accepted'
            and e.provider='sumsub'
        )
    ) then
      raise exception 'Local verification_state=verified requires approved external identity and liveness evidence';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."local_require_approved_verification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_expired_events"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  update public.ai_discovered_events
  set status = 'expired'
  where status = 'approved'
    and start_at < now();
  return NEW;
end;
$$;


ALTER FUNCTION "public"."mark_expired_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_service_provider_payout_eligible"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_payment public.service_payment_ledger; v_profile uuid; v_owner uuid;
begin
  if new.status <> 'completed' or old.status = 'completed' then return new; end if;
  select * into v_payment from public.service_payment_ledger where appointment_id=new.id;
  if v_payment.id is null or v_payment.status <> 'paid' then return new; end if;
  select sp.id,b.owner_id into v_profile,v_owner
  from public.service_profiles sp join public.businesses b on b.id=sp.business_id
  where sp.id=new.service_profile_id;
  if v_profile is null then return new; end if;
  insert into public.service_provider_payouts(
    appointment_id,service_profile_id,provider_user_id,currency,
    gross_amount,platform_fee_percent,platform_fee_amount,provider_net_amount,status,eligible_at
  ) values (
    new.id,v_profile,v_owner,v_payment.currency,v_payment.gross_amount,v_payment.platform_fee_percent,
    v_payment.platform_fee_amount,v_payment.provider_net_amount,'eligible',now()
  )
  on conflict (appointment_id) do update set
    status=case when public.service_provider_payouts.status in ('paid','processing') then public.service_provider_payouts.status else 'eligible' end,
    eligible_at=coalesce(public.service_provider_payouts.eligible_at,now()),
    updated_at=now();
  return new;
end;
$$;


ALTER FUNCTION "public"."mark_service_provider_payout_eligible"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prepare_service_provider_payout"("payout_id" "uuid") RETURNS "public"."service_provider_payouts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare p public.service_provider_payouts;
begin
 select * into p from public.service_provider_payouts where id=payout_id for update;
 if not found then raise exception 'payout_not_found'; end if;
 if p.status <> 'approved' then raise exception 'payout_not_approved'; end if;
 if p.currency <> 'KES' then raise exception 'payout_currency_not_supported'; end if;
 if p.provider_net_amount <= 0 then raise exception 'payout_amount_invalid'; end if;
 if p.provider_phone is null or length(trim(p.provider_phone)) < 10 then raise exception 'payout_destination_missing'; end if;
 if p.processing_at is not null or p.status='processing' then raise exception 'payout_already_processing'; end if;
 update public.service_provider_payouts set status='processing', processing_at=now(), payout_provider='mpesa', originator_conversation_id=coalesce(originator_conversation_id,'SP-PAYOUT-'||replace(p.id::text,'-','')), updated_at=now() where id=p.id returning * into p;
 return p;
end; $$;


ALTER FUNCTION "public"."prepare_service_provider_payout"("payout_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_food_order_payment_state"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$ begin if old.payment_status = 'refunded' and new.payment_status <> 'refunded' then new.payment_status := 'refunded'; new.payment_reference := coalesce(new.payment_reference, old.payment_reference); new.payment_intent_id := coalesce(new.payment_intent_id, old.payment_intent_id); new.refunded_amount := greatest(new.refunded_amount, old.refunded_amount); new.refund_reference := coalesce(new.refund_reference, old.refund_reference); new.refunded_at := coalesce(new.refunded_at, old.refunded_at); elsif old.payment_status = 'paid' and new.payment_status not in ('paid','refunded','disputed') then new.payment_status := 'paid'; new.payment_reference := coalesce(new.payment_reference, old.payment_reference); new.payment_intent_id := coalesce(new.payment_intent_id, old.payment_intent_id); end if; if new.status in ('accepted','preparing','ready','driver_assigned','picked_up','on_the_way','delivered') and new.payment_status not in ('paid','refunded') then raise exception using errcode='23514',message='Restaurant order must be paid before fulfillment begins'; end if; if old.status is distinct from new.status and new.status='cancelled' and old.payment_status='paid' and new.payment_status <> 'refunded' then raise exception using errcode='23514',message='Paid restaurant orders require a refund before cancellation'; end if; if new.status='cancelled' and old.payment_status <> 'paid' and new.payment_status='paid' then new.payment_status='disputed'; end if; if new.payment_status='refunded' then if new.refunded_amount <= 0 then raise exception using errcode='23514',message='Refunded restaurant orders require a positive refund amount'; end if; if new.refunded_amount > new.customer_total then raise exception using errcode='23514',message='Restaurant refund cannot exceed customer total'; end if; new.refunded_at := coalesce(new.refunded_at,now()); end if; return new; end; $$;


ALTER FUNCTION "public"."protect_food_order_payment_state"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_trip_item_service_appointment_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'UPDATE' then
    if old.appointment_id is not null then
      if new.trip_id is distinct from old.trip_id
         or new.appointment_id is distinct from old.appointment_id
         or new.item_kind is distinct from old.item_kind
         or new.title is distinct from old.title
         or new.start_at is distinct from old.start_at
         or new.end_at is distinct from old.end_at
         or new.city_id is distinct from old.city_id then
        raise exception 'service_appointment_trip_item_immutable';
      end if;
    elsif new.appointment_id is not null then
      raise exception 'service_appointment_trip_item_attach_requires_rpc';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."protect_trip_item_service_appointment_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reconcile_service_provider_payouts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ declare n integer := 0; begin update public.service_provider_payouts set status='held', failure_reason='Reconciliation required: payout has remained processing beyond expected callback window', updated_at=now() where status='processing' and processing_at < now() - interval '24 hours'; get diagnostics n = row_count; return n; end; $$;


ALTER FUNCTION "public"."reconcile_service_provider_payouts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_driver_compliance"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  changed integer := 0;
  r record;
  license_status text;
  registration_status text;
  insurance_status text;
  days_left integer;
begin
  for r in select * from public.driver_compliance_overview loop
    license_status := case when r.driving_license_expires_on is null then 'missing' when r.driving_license_expires_on < current_date then 'expired' when r.driving_license_expires_on <= current_date + 60 then 'expiring_soon' else 'valid' end;
    update public.driver_profiles set driving_license_compliance_status = license_status, updated_at = now() where id = r.driver_id and driving_license_compliance_status <> license_status;
    changed := changed + case when found then 1 else 0 end;

    if r.vehicle_id is not null then
      registration_status := case when r.registration_expires_on is null then 'missing' when r.registration_expires_on < current_date then 'expired' when r.registration_expires_on <= current_date + 60 then 'expiring_soon' else 'valid' end;
      insurance_status := case when r.insurance_expires_on is null then 'missing' when r.insurance_expires_on < current_date then 'expired' when r.insurance_expires_on <= current_date + 60 then 'expiring_soon' else 'valid' end;
      update public.vehicles set registration_compliance_status = registration_status, insurance_compliance_status = insurance_status, updated_at = now() where id = r.vehicle_id;

      if r.registration_expires_on is not null then
        days_left := r.registration_expires_on - current_date;
        if days_left in (60,30,7) then insert into public.driver_compliance_alerts(driver_id,vehicle_id,document_type,expires_on,alert_type) values(r.driver_id,r.vehicle_id,'vehicle_registration',r.registration_expires_on,days_left||'_day') on conflict do nothing; end if;
        if days_left < 0 then insert into public.driver_compliance_alerts(driver_id,vehicle_id,document_type,expires_on,alert_type) values(r.driver_id,r.vehicle_id,'vehicle_registration',r.registration_expires_on,'expired') on conflict do nothing; end if;
      end if;
      if r.insurance_expires_on is not null then
        days_left := r.insurance_expires_on - current_date;
        if days_left in (60,30,7) then insert into public.driver_compliance_alerts(driver_id,vehicle_id,document_type,expires_on,alert_type) values(r.driver_id,r.vehicle_id,'insurance',r.insurance_expires_on,days_left||'_day') on conflict do nothing; end if;
        if days_left < 0 then insert into public.driver_compliance_alerts(driver_id,vehicle_id,document_type,expires_on,alert_type) values(r.driver_id,r.vehicle_id,'insurance',r.insurance_expires_on,'expired') on conflict do nothing; end if;
      end if;
    end if;

    if r.driving_license_expires_on is not null then
      days_left := r.driving_license_expires_on - current_date;
      if days_left in (60,30,7) then insert into public.driver_compliance_alerts(driver_id,document_type,expires_on,alert_type) values(r.driver_id,'driving_license',r.driving_license_expires_on,days_left||'_day') on conflict do nothing; end if;
      if days_left < 0 then insert into public.driver_compliance_alerts(driver_id,document_type,expires_on,alert_type) values(r.driver_id,'driving_license',r.driving_license_expires_on,'expired') on conflict do nothing; end if;
    end if;

    if r.service_status = 'active' and (license_status in ('missing','expired','rejected') or registration_status in ('missing','expired','rejected') or insurance_status in ('missing','expired','rejected')) then
      update public.driver_profiles set service_status = 'suspended', updated_at = now() where id = r.driver_id;
    end if;
  end loop;
  return changed;
end;
$$;


ALTER FUNCTION "public"."refresh_driver_compliance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_ai_scout_lease"("p_owner" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.ai_scout_locks
  set locked_until = null,
      locked_by = null,
      updated_at = now()
  where lock_name = 'global'
    and locked_by = p_owner;

  return found;
end;
$$;


ALTER FUNCTION "public"."release_ai_scout_lease"("p_owner" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_trip_items"("p_trip_id" "uuid", "p_traveler_id" "uuid", "p_item_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_item_id uuid;
  v_position integer := 0;
  v_count integer;
  v_trip_id uuid;
begin
  select t.id into v_trip_id from public.trips t where t.id = p_trip_id and t.traveler_id = p_traveler_id for update;
  if v_trip_id is null then raise exception 'trip_not_found'; end if;
  if coalesce(array_length(p_item_ids,1),0)=0 then raise exception 'items_required'; end if;
  select count(*) into v_count from unnest(p_item_ids) x;
  if v_count <> (select count(distinct x) from unnest(p_item_ids) x) then raise exception 'duplicate_item_ids'; end if;
  if (select count(*) from public.trip_items ti where ti.trip_id=p_trip_id and ti.id=any(p_item_ids)) <> v_count then raise exception 'item_not_in_trip'; end if;
  for v_item_id in select x from unnest(p_item_ids) x order by x loop
    perform 1 from public.trip_items ti where ti.id=v_item_id and ti.trip_id=p_trip_id for update;
  end loop;
  update public.trip_items ti set position = s.position from (select x as id, row_number() over () - 1 as position from unnest(p_item_ids) x) s where ti.id=s.id and ti.trip_id=p_trip_id;
  update public.trips set updated_at=now() where id=p_trip_id and traveler_id=p_traveler_id;
end;
$$;


ALTER FUNCTION "public"."reorder_trip_items"("p_trip_id" "uuid", "p_traveler_id" "uuid", "p_item_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."requeue_stale_ai_scout_jobs"("p_stale_minutes" integer DEFAULT 5) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  recovered integer;
begin
  update public.ai_scout_runs
  set status = case when attempt_count < max_attempts then 'queued' else 'failed' end,
      queued_at = case when attempt_count < max_attempts then now() else queued_at end,
      claimed_at = null,
      started_at = case when attempt_count < max_attempts then null else started_at end,
      completed_at = case when attempt_count < max_attempts then null else now() end,
      worker_stage = case when attempt_count < max_attempts then 'queued' else 'failed' end,
      provider_response_id = case when attempt_count < max_attempts then null else provider_response_id end,
      provider_status = case when attempt_count < max_attempts then null else provider_status end,
      poll_lease_until = null,
      last_error = case when attempt_count < max_attempts then null else 'Worker exceeded stale execution threshold before provider start' end,
      notes = case
        when attempt_count < max_attempts then 'AI Scout recovered a stale pre-provider claim and returned this mission to the queue.'
        else 'AI Scout exceeded the pre-provider stale threshold and exhausted its retry limit.'
      end
  where status = 'running'
    and queued_at is not null
    and provider_response_id is null
    and coalesce(claimed_at, started_at, created_at) < now() - make_interval(mins => greatest(coalesce(p_stale_minutes, 5), 5));

  get diagnostics recovered = row_count;
  return recovered;
end;
$$;


ALTER FUNCTION "public"."requeue_stale_ai_scout_jobs"("p_stale_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."requeue_transient_ai_scout_failures"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  recovered integer;
begin
  update public.ai_scout_runs
  set status = 'queued',
      worker_stage = 'queued',
      provider_response_id = null,
      provider_status = null,
      poll_lease_until = null,
      claimed_at = null,
      started_at = null,
      completed_at = null,
      queued_at = now(),
      attempt_count = greatest(attempt_count - 1, 0),
      provider_failure_count = provider_failure_count + 1,
      last_provider_error = last_error,
      notes = 'OpenAI provider failure recovered automatically; mission returned to queue without consuming a Scout attempt.',
      last_error = null
  where status = 'failed'
    and queued_at is not null
    and last_error is not null
    and provider_failure_count < 5
    and (
      lower(last_error) like '%rate limit%'
      or lower(last_error) like '%tokens per min%'
      or lower(last_error) like '%tpm%'
      or lower(last_error) like '%429%'
      or lower(last_error) like '%temporarily unavailable%'
      or lower(last_error) like '%server overloaded%'
      or lower(last_error) like '%timeout%'
      or lower(last_error) like '%timed out%'
      or lower(last_error) like '%provider%'
      or lower(last_error) like '%background response ended with status%'
      or lower(last_error) like '%poll openai%'
    );

  get diagnostics recovered = row_count;
  return recovered;
end;
$$;


ALTER FUNCTION "public"."requeue_transient_ai_scout_failures"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reschedule_service_appointment"("p_appointment_id" "uuid", "p_customer_user_id" "uuid", "p_starts_at" timestamp with time zone, "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."service_appointments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_appointment public.service_appointments;
  v_offering public.service_offerings;
  v_profile public.service_profiles;
  v_business public.businesses;
  v_ends_at timestamptz;
begin
  select * into v_appointment
  from public.service_appointments
  where id = p_appointment_id
    and customer_user_id = p_customer_user_id
  for update;

  if not found then raise exception 'appointment_not_found'; end if;
  if v_appointment.status not in ('pending','confirmed') then raise exception 'appointment_not_reschedulable'; end if;

  select * into v_profile
  from public.service_profiles
  where id = v_appointment.service_profile_id;
  if not found or v_profile.status <> 'active' or v_profile.booking_status <> 'open' then raise exception 'service_not_bookable'; end if;

  select * into v_business from public.businesses where id = v_profile.business_id;
  if not found or v_business.status <> 'active' then raise exception 'service_not_bookable'; end if;

  select * into v_offering
  from public.service_offerings
  where id = v_appointment.offering_id
    and service_profile_id = v_appointment.service_profile_id
    and status = 'active';
  if not found then raise exception 'service_not_bookable'; end if;

  if p_starts_at is null then raise exception 'invalid_appointment_time'; end if;
  v_ends_at := p_starts_at + make_interval(mins => v_offering.duration_minutes);

  update public.service_appointments
  set starts_at = p_starts_at,
      ends_at = v_ends_at,
      updated_at = now()
  where id = v_appointment.id
  returning * into v_appointment;

  insert into public.service_appointment_status_events(
    appointment_id, from_status, to_status, actor_type, actor_user_id, note
  ) values (
    v_appointment.id,
    v_appointment.status,
    v_appointment.status,
    'customer',
    p_customer_user_id,
    coalesce(nullif(p_note,''), 'Appointment rescheduled')
  );

  return v_appointment;
end;
$$;


ALTER FUNCTION "public"."reschedule_service_appointment"("p_appointment_id" "uuid", "p_customer_user_id" "uuid", "p_starts_at" timestamp with time zone, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."respond_to_driver_transfer_request"("p_request_id" "uuid", "p_decision" "text") RETURNS "public"."driver_transfer_requests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_driver public.driver_profiles; v_request public.driver_transfer_requests; v_conflict boolean;
begin
 if p_decision not in ('accepted','declined') then raise exception 'invalid_decision'; end if;
 select * into v_driver from public.driver_profiles where user_id=auth.uid();
 if v_driver.id is null then raise exception 'driver_profile_required'; end if;
 select * into v_request from public.driver_transfer_requests where id=p_request_id and driver_id=v_driver.id for update;
 if v_request.id is null then raise exception 'request_not_found'; end if;
 if v_request.status <> 'requested' then raise exception 'request_already_resolved'; end if;
 if p_decision='accepted' then
   if v_driver.service_status<>'active' or v_driver.verification_state<>'verified' or v_driver.driving_license_compliance_status not in ('valid','expiring_soon') then raise exception 'driver_not_eligible'; end if;
   select exists(select 1 from public.driver_availability a where a.driver_id=v_driver.id and a.available_on=v_request.requested_at::date and a.status='unavailable' and (a.start_time is null or a.start_time<=v_request.requested_at::time) and (a.end_time is null or a.end_time>v_request.requested_at::time)) into v_conflict;
   if v_conflict then raise exception 'driver_unavailable'; end if;
 end if;
 update public.driver_transfer_requests set status=p_decision, updated_at=now() where id=v_request.id returning * into v_request;
 return v_request;
end;$$;


ALTER FUNCTION "public"."respond_to_driver_transfer_request"("p_request_id" "uuid", "p_decision" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sanitize_ai_discovered_event_image"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v text;
begin
  v := lower(coalesce(btrim(new.image_url), ''));

  if v = ''
     or v !~ '^https?://[^/]+/.+'
     or v like '%undefined%'
     or v like '%null%'
     or v like '%og-default%'
     or v like '%default-og%'
     or v like '%placeholder%'
     or v like '%/favicon%'
     or v like '%/logo.%'
     or v like '%/logo/%' then
    new.image_url := null;
    new.image_verified := false;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sanitize_ai_discovered_event_image"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."service_appointment_require_verified_traveler"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.customer_user_id is null then
    raise exception 'traveler_verification_required';
  end if;

  if not exists (
    select 1
    from public.verification_cases vc
    where vc.subject_type = 'traveler'
      and vc.subject_id = new.customer_user_id
      and vc.status = 'approved'
      and (vc.expires_at is null or vc.expires_at > now())
  ) then
    raise exception 'traveler_verification_required';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."service_appointment_require_verified_traveler"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."service_appointment_require_verified_traveler"() IS 'Trigger-only guard requiring an approved, unexpired traveler verification before a service appointment can be linked to a customer account.';



CREATE OR REPLACE FUNCTION "public"."service_provider_verification_ready"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.verification_cases vc
    WHERE vc.subject_type = 'provider'
      AND vc.subject_id = p_user_id
      AND vc.status = 'approved'
      AND (vc.expires_at IS NULL OR vc.expires_at > now())
      AND vc.verification_level IN ('identity','enhanced')
      AND EXISTS (
        SELECT 1 FROM public.verification_evidence ve
        WHERE ve.case_id = vc.id
          AND ve.evidence_type = 'identity'
          AND ve.status = 'accepted'
          AND (ve.expires_at IS NULL OR ve.expires_at > now())
      )
      AND EXISTS (
        SELECT 1 FROM public.verification_evidence ve
        WHERE ve.case_id = vc.id
          AND ve.evidence_type = 'liveness'
          AND ve.status = 'accepted'
          AND (ve.expires_at IS NULL OR ve.expires_at > now())
      )
  );
$$;


ALTER FUNCTION "public"."service_provider_verification_ready"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."service_staff_require_external_verification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.verification_state='verified' then
    if new.user_id is null then
      raise exception 'Verified service specialist requires linked SafariPlug account';
    end if;
    if new.identity_liveness_verified_at is null then
      raise exception 'Verified service specialist requires identity_liveness_verified_at';
    end if;
    if not exists (
      select 1
      from public.verification_cases c
      where c.subject_type='service_staff'
        and c.subject_id=new.id
        and c.status='approved'
        and c.provider='sumsub'
        and (c.expires_at is null or c.expires_at > now())
        and exists (
          select 1 from public.verification_evidence e
          where e.case_id=c.id
            and e.evidence_type='identity'
            and e.status='accepted'
            and e.provider='sumsub'
        )
        and exists (
          select 1 from public.verification_evidence e
          where e.case_id=c.id
            and e.evidence_type='liveness'
            and e.status='accepted'
            and e.provider='sumsub'
        )
    ) then
      raise exception 'Verified service specialist requires approved external identity and liveness evidence';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."service_staff_require_external_verification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_activity_booking_pricing_ledger_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_activity_booking_pricing_ledger_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_hotel_booking_pricing_ledger_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_hotel_booking_pricing_ledger_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_hotelbeds_content_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_hotelbeds_content_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_restaurant_food_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_restaurant_food_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_service_provider_payout_status"("p_payout_id" "uuid", "p_status" "text", "p_provider" "text" DEFAULT NULL::"text", "p_reference" "text" DEFAULT NULL::"text", "p_failure_reason" "text" DEFAULT NULL::"text") RETURNS "public"."service_provider_payouts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_result public.service_provider_payouts;
begin
  if p_status not in ('pending','eligible','processing','paid','failed','on_hold','cancelled') then raise exception 'invalid_payout_status'; end if;
  update public.service_provider_payouts
  set status=p_status,
      payout_provider=coalesce(p_provider,payout_provider),
      payout_reference=coalesce(p_reference,payout_reference),
      failure_reason=case when p_status='failed' then p_failure_reason else null end,
      paid_at=case when p_status='paid' then coalesce(paid_at,now()) else paid_at end,
      updated_at=now()
  where id=p_payout_id
  returning * into v_result;
  if v_result.id is null then raise exception 'payout_not_found'; end if;
  return v_result;
end;
$$;


ALTER FUNCTION "public"."set_service_provider_payout_status"("p_payout_id" "uuid", "p_status" "text", "p_provider" "text", "p_reference" "text", "p_failure_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_supplier_completion_on_account"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  new.completion_percent := public.supplier_completion(new.business_id);
  return new;
end;
$$;


ALTER FUNCTION "public"."set_supplier_completion_on_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_transfer_booking_pricing_ledger_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_transfer_booking_pricing_ledger_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_supplier_for_review"("p_supplier_id" "uuid", "p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_business_id uuid;
  v_status text;
  v_completion integer;
  v_now timestamptz := now();
begin
  select business_id, onboarding_status
  into v_business_id, v_status
  from public.supplier_accounts
  where id = p_supplier_id
    and user_id = p_user_id
  for update;

  if v_business_id is null then
    raise exception 'Supplier account not found';
  end if;

  if v_status in ('approved','live') then
    raise exception 'Approved suppliers cannot be resubmitted';
  end if;

  v_completion := public.supplier_completion(v_business_id);
  if v_completion < 80 then
    raise exception 'Supplier profile must be at least 80%% complete before submission';
  end if;

  update public.businesses
  set status = 'pending',
      updated_at = v_now
  where id = v_business_id
    and owner_id = p_user_id;

  if not found then
    raise exception 'Supplier business ownership mismatch';
  end if;

  update public.supplier_accounts
  set onboarding_status = 'submitted',
      invitation_status = 'accepted',
      accepted_at = coalesce(accepted_at, v_now),
      submitted_at = v_now,
      completion_percent = v_completion,
      review_items = '[]'::jsonb,
      review_note = null,
      review_requested_at = null,
      updated_at = v_now
  where id = p_supplier_id
    and user_id = p_user_id;

  return v_completion;
end;
$$;


ALTER FUNCTION "public"."submit_supplier_for_review"("p_supplier_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."submit_supplier_for_review"("p_supplier_id" "uuid", "p_user_id" "uuid") IS 'Server-only atomic transition from supplier onboarding to staff review. Verifies ownership and minimum profile completion before changing business/account state.';



CREATE OR REPLACE FUNCTION "public"."supplier_completion"("p_business_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ with b as (select * from public.businesses where id=p_business_id), checks as (select (case when nullif(trim(coalesce(name,'')),'') is not null then 1 else 0 end)+(case when nullif(trim(coalesce(description,'')),'') is not null then 1 else 0 end)+(case when nullif(trim(coalesce(phone,'')),'') is not null then 1 else 0 end)+(case when nullif(trim(coalesce(email,'')),'') is not null then 1 else 0 end)+(case when nullif(trim(coalesce(address,'')),'') is not null then 1 else 0 end)+(case when nullif(trim(coalesce(website_url,'')),'') is not null then 1 else 0 end)+(case when nullif(trim(coalesce(logo_url,'')),'') is not null then 1 else 0 end)+(case when nullif(trim(coalesce(cover_image_url,'')),'') is not null then 1 else 0 end)+(case when coalesce(array_length(supplier_gallery_urls,1),0)>0 then 1 else 0 end)+(case when exists(select 1 from public.service_profiles sp where sp.business_id=p_business_id) then 1 else 0 end) as completed,10 as total from b) select round(completed*100.0/total)::integer from checks; $$;


ALTER FUNCTION "public"."supplier_completion"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_food_order_delivery_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'rejected') THEN
    UPDATE public.food_delivery_assignments
    SET status = 'cancelled', updated_at = COALESCE(NEW.updated_at, now())
    WHERE order_id = NEW.id
      AND status IN ('assigned', 'accepted', 'arrived_at_restaurant', 'picked_up', 'on_the_way');
  ELSIF NEW.status = 'delivered' THEN
    UPDATE public.food_delivery_assignments
    SET status = 'delivered', updated_at = COALESCE(NEW.updated_at, now())
    WHERE order_id = NEW.id
      AND status IN ('assigned', 'accepted', 'arrived_at_restaurant', 'picked_up', 'on_the_way');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_food_order_delivery_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_hotel_trip_item_ledger_reference"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  ledger_uuid uuid;
begin
  if new.item_kind = 'hotel' and new.hotel_booking_pricing_ledger_id is null and new.notes is not null then
    begin
      ledger_uuid := substring(new.notes from 'SafariPlug hotel ledger: ([0-9a-fA-F-]{36})')::uuid;
      new.hotel_booking_pricing_ledger_id := ledger_uuid;
    exception when others then
      new.hotel_booking_pricing_ledger_id := null;
    end;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_hotel_trip_item_ledger_reference"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_service_appointment_journey_times"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at then
    update public.trip_items
    set start_at = new.starts_at,
        end_at = new.ends_at
    where appointment_id = new.id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_service_appointment_journey_times"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_service_payment_ledger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.service_payment_ledger (appointment_id,currency,gross_amount,platform_fee_percent,platform_fee_amount,provider_net_amount,status,service_fee_minimum,customer_fee_percent,customer_fee_amount,customer_total_amount,payout_minimum)
  values (new.id,new.currency,greatest(coalesce(new.price,0),0),coalesce(new.service_fee_percent,10),greatest(coalesce(new.service_fee_amount,0),0),greatest(coalesce(new.provider_net_amount,0),0),coalesce(new.payment_status,'unpaid'),coalesce(new.service_fee_minimum,30),coalesce(new.customer_fee_percent,0),greatest(coalesce(new.customer_fee_amount,0),0),greatest(coalesce(new.customer_total_amount,new.price),0),coalesce(new.payout_minimum,1000))
  on conflict (appointment_id) do update set currency=excluded.currency,gross_amount=excluded.gross_amount,platform_fee_percent=excluded.platform_fee_percent,platform_fee_amount=excluded.platform_fee_amount,provider_net_amount=excluded.provider_net_amount,status=excluded.status,service_fee_minimum=excluded.service_fee_minimum,customer_fee_percent=excluded.customer_fee_percent,customer_fee_amount=excluded.customer_fee_amount,customer_total_amount=excluded.customer_total_amount,payout_minimum=excluded.payout_minimum,updated_at=now();
  return new;
end; $$;


ALTER FUNCTION "public"."sync_service_payment_ledger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_service_provider_payout"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_service_profile_id uuid; v_provider_user_id uuid; v_payout_min numeric(12,2); v_gross numeric(12,2); v_fee_pct numeric(5,2); v_fee numeric(12,2); v_net numeric(12,2); v_status text;
begin
  select sa.service_profile_id,b.owner_id,coalesce(sp.payout_minimum,1000) into v_service_profile_id,v_provider_user_id,v_payout_min from public.service_appointments sa join public.service_profiles sp on sp.id=sa.service_profile_id join public.businesses b on b.id=sp.business_id where sa.id=new.appointment_id;
  if v_service_profile_id is null then return new; end if;
  v_gross:=greatest(coalesce(new.gross_amount,0),0); v_fee_pct:=greatest(least(coalesce(new.platform_fee_percent,10),100),0); v_fee:=greatest(round(v_gross*v_fee_pct/100,2),coalesce(new.platform_fee_amount,0)); v_fee:=least(v_fee,v_gross); v_net:=greatest(round(v_gross-v_fee-coalesce(new.processor_fee_amount,0)-coalesce(new.refund_amount,0),2),0); v_status:=case when new.status='paid' then 'eligible' else coalesce(new.status,'pending') end;
  insert into public.service_provider_payouts(appointment_id,service_profile_id,provider_user_id,currency,gross_amount,platform_fee_percent,platform_fee_amount,processor_fee_amount,refund_amount,provider_net_amount,status,payout_minimum)
  values(new.appointment_id,v_service_profile_id,v_provider_user_id,new.currency,v_gross,v_fee_pct,v_fee,coalesce(new.metadata->>'processor_fee_amount','0')::numeric,coalesce(new.refunded_amount,0),v_net,v_status,v_payout_min)
  on conflict(appointment_id) do update set currency=excluded.currency,gross_amount=excluded.gross_amount,platform_fee_percent=excluded.platform_fee_percent,platform_fee_amount=excluded.platform_fee_amount,refund_amount=excluded.refund_amount,provider_net_amount=excluded.provider_net_amount,payout_minimum=excluded.payout_minimum,updated_at=now();
  return new;
end; $$;


ALTER FUNCTION "public"."sync_service_provider_payout"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_supplier_completion_from_business"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_completion integer;
begin
  v_completion := public.supplier_completion(new.id);

  update public.supplier_accounts
  set completion_percent = v_completion,
      updated_at = now()
  where business_id = new.id
    and completion_percent is distinct from v_completion;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_supplier_completion_from_business"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_supplier_completion_from_service_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_business_id uuid;
  v_previous_business_id uuid;
  v_completion integer;
begin
  if tg_op = 'DELETE' then
    v_business_id := old.business_id;
  else
    v_business_id := new.business_id;
  end if;

  if v_business_id is not null then
    v_completion := public.supplier_completion(v_business_id);
    update public.supplier_accounts
    set completion_percent = v_completion,
        updated_at = now()
    where business_id = v_business_id
      and completion_percent is distinct from v_completion;
  end if;

  if tg_op = 'UPDATE' and old.business_id is distinct from new.business_id then
    v_previous_business_id := old.business_id;
    if v_previous_business_id is not null then
      v_completion := public.supplier_completion(v_previous_business_id);
      update public.supplier_accounts
      set completion_percent = v_completion,
          updated_at = now()
      where business_id = v_previous_business_id
        and completion_percent is distinct from v_completion;
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


ALTER FUNCTION "public"."sync_supplier_completion_from_service_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_service_appointment_status"("p_appointment_id" "uuid", "p_to_status" "text", "p_actor_type" "text", "p_actor_user_id" "uuid" DEFAULT NULL::"uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."service_appointments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_appointment public.service_appointments; v_from_status text; v_allowed boolean := false;
begin
  if p_actor_type not in ('customer','provider','admin','system') then raise exception 'invalid_actor_type'; end if;
  select * into v_appointment from public.service_appointments where id=p_appointment_id for update;
  if not found then raise exception 'appointment_not_found'; end if;
  v_from_status:=v_appointment.status;
  if p_to_status not in ('pending','confirmed','checked_in','in_progress','completed','cancelled','no_show') then raise exception 'invalid_appointment_status'; end if;
  if p_to_status='cancelled' and v_appointment.payment_status in ('paid','partially_refunded') then raise exception 'settled_payment_requires_refund_review'; end if;
  v_allowed:=case when v_from_status='pending' then p_to_status in ('confirmed','cancelled') when v_from_status='confirmed' then p_to_status in ('checked_in','cancelled','no_show') when v_from_status='checked_in' then p_to_status in ('in_progress','cancelled','no_show') when v_from_status='in_progress' then p_to_status in ('completed','cancelled') else false end;
  if not v_allowed then raise exception 'invalid_status_transition:%:%',v_from_status,p_to_status; end if;
  update public.service_appointments set status=p_to_status,cancellation_reason=case when p_to_status='cancelled' then coalesce(nullif(p_note,''),cancellation_reason) else cancellation_reason end,updated_at=now() where id=v_appointment.id returning * into v_appointment;
  insert into public.service_appointment_status_events(appointment_id,from_status,to_status,actor_type,actor_user_id,note) values(v_appointment.id,v_from_status,p_to_status,p_actor_type,p_actor_user_id,p_note);
  return v_appointment;
end; $$;


ALTER FUNCTION "public"."transition_service_appointment_status"("p_appointment_id" "uuid", "p_to_status" "text", "p_actor_type" "text", "p_actor_user_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."travel_os_lock_user_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$ begin if coalesce(auth.role(), '') is distinct from 'service_role' then NEW.status := 'quote'; NEW.supplier_reference := null; if NEW.price_source = 'supplier' then NEW.price_source := 'unconfirmed_listed'; end if; end if; return NEW; end; $$;


ALTER FUNCTION "public"."travel_os_lock_user_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."travel_os_log_booking_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ begin if TG_OP = 'INSERT' then insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, note) values (NEW.id, null, NEW.status, NEW.traveler_id, 'Quote created. Provider confirmation is not available.'); elsif TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, note) values (NEW.id, OLD.status, NEW.status, auth.uid(), 'status change'); end if; return NEW; end; $$;


ALTER FUNCTION "public"."travel_os_log_booking_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."travel_os_require_approved_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ begin if NEW.event_id is not null and not exists (select 1 from public.events e where e.id = NEW.event_id and e.status = 'approved') then raise exception 'Only approved events can be referenced by Travel OS records'; end if; return NEW; end; $$;


ALTER FUNCTION "public"."travel_os_require_approved_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."travel_os_require_approved_offering"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ begin if NEW.offering_id is not null and not exists (select 1 from public.offerings o where o.id = NEW.offering_id and o.status = 'approved') then raise exception 'Only approved offerings can be referenced by Travel OS records'; end if; return NEW; end; $$;


ALTER FUNCTION "public"."travel_os_require_approved_offering"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."try_acquire_ai_scout_lease"("p_owner" "text", "p_lease_seconds" integer DEFAULT 900) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.ai_scout_locks
  set locked_until = now() + make_interval(secs => greatest(p_lease_seconds, 60)),
      locked_by = p_owner,
      updated_at = now()
  where lock_name = 'global'
    and (locked_until is null or locked_until < now());

  return found;
end;
$$;


ALTER FUNCTION "public"."try_acquire_ai_scout_lease"("p_owner" "text", "p_lease_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_events_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;


ALTER FUNCTION "public"."update_events_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_food_order_item_amounts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if new.unit_price < 0 or new.line_total < 0 or new.quantity <= 0 then
    raise exception 'Invalid food order item amount';
  end if;
  if new.line_total <> round(new.unit_price * new.quantity, 2) then
    raise exception 'Food order item line total does not match quantity and unit price';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_food_order_item_amounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_restaurant_menu_item_category"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.restaurant_menu_categories c
    where c.id = new.category_id and c.business_id = new.business_id
  ) then
    raise exception 'Menu category must belong to the same restaurant';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_restaurant_menu_item_category"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_service_appointment_time_window"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_profile public.service_profiles;
  v_staff public.service_staff;
  v_offering public.service_offerings;
  v_local_start timestamp;
  v_local_end timestamp;
  v_day smallint;
  v_start_time time;
  v_end_time time;
begin
  if tg_op = 'UPDATE' and new.starts_at is not distinct from old.starts_at and new.ends_at is not distinct from old.ends_at then
    return new;
  end if;

  select * into v_profile from public.service_profiles where id = new.service_profile_id and status = 'active' and booking_status = 'open';
  if not found then raise exception 'service_not_bookable'; end if;

  select * into v_staff from public.service_staff where id = new.staff_id and service_profile_id = new.service_profile_id and status = 'active';
  if not found then raise exception 'staff_not_bookable'; end if;

  select * into v_offering from public.service_offerings where id = new.offering_id and service_profile_id = new.service_profile_id and status = 'active';
  if not found then raise exception 'service_not_bookable'; end if;

  if new.ends_at <= new.starts_at then raise exception 'invalid_appointment_time'; end if;
  if new.starts_at < now() + make_interval(mins => v_profile.booking_notice_minutes) then raise exception 'booking_notice_violation'; end if;
  if new.starts_at > now() + make_interval(days => v_profile.max_booking_days) then raise exception 'booking_window_violation'; end if;

  v_local_start := new.starts_at at time zone v_profile.timezone;
  v_local_end := new.ends_at at time zone v_profile.timezone;
  if v_local_end::date <> v_local_start::date then raise exception 'staff_unavailable'; end if;
  v_day := extract(dow from v_local_start)::smallint;
  v_start_time := v_local_start::time;
  v_end_time := v_local_end::time;

  if not exists (
    select 1 from public.service_staff_availability sa
    where sa.staff_id = new.staff_id and sa.is_active = true and sa.day_of_week = v_day
      and sa.start_time <= v_start_time and sa.end_time >= v_end_time
  ) then raise exception 'staff_unavailable'; end if;

  if exists (
    select 1 from public.service_staff_blockouts
    where staff_id = new.staff_id and starts_at < new.ends_at and ends_at > new.starts_at
  ) then raise exception 'staff_unavailable'; end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_service_appointment_time_window"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verification_events_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$ begin raise exception 'verification_events is append-only'; end; $$;


ALTER FUNCTION "public"."verification_events_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_ai_scout_worker_token"("p_token" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'ai_scout_worker_token'
      and decrypted_secret = p_token
  );
$$;


ALTER FUNCTION "public"."verify_ai_scout_worker_token"("p_token" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_booking_pricing_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'hotelbeds'::"text" NOT NULL,
    "prepared_booking_id" "text" NOT NULL,
    "provider_booking_reference" "text",
    "supplier_currency" "text" NOT NULL,
    "customer_currency" "text" NOT NULL,
    "exchange_rate" numeric(20,10),
    "supplier_amount" numeric(14,2) NOT NULL,
    "retail_amount" numeric(14,2) NOT NULL,
    "markup_percent" numeric(6,3) DEFAULT 10 NOT NULL,
    "payment_provider" "text",
    "payment_reference" "text",
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "booking_status" "text" DEFAULT 'preconfirm_pending'::"text" NOT NULL,
    "supplier_settlement_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "paid_at" timestamp with time zone,
    "preconfirmed_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checkout_intent_key" "text",
    "preconfirm_initiation_started_at" timestamp with time zone,
    "payment_initiation_started_at" timestamp with time zone,
    CONSTRAINT "activity_booking_pricing_ledge_supplier_settlement_status_check" CHECK (("supplier_settlement_status" = ANY (ARRAY['pending'::"text", 'settled'::"text", 'failed'::"text"]))),
    CONSTRAINT "activity_booking_pricing_ledger_booking_status_check" CHECK (("booking_status" = ANY (ARRAY['preconfirm_pending'::"text", 'preconfirmed'::"text", 'payment_pending'::"text", 'confirmed'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "activity_booking_pricing_ledger_markup_percent_check" CHECK (("markup_percent" >= (0)::numeric)),
    CONSTRAINT "activity_booking_pricing_ledger_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "activity_booking_pricing_ledger_retail_amount_check" CHECK (("retail_amount" >= (0)::numeric)),
    CONSTRAINT "activity_booking_pricing_ledger_supplier_amount_check" CHECK (("supplier_amount" >= (0)::numeric))
);


ALTER TABLE "public"."activity_booking_pricing_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity_booking_pricing_ledger" IS 'Server-only governed Hotelbeds Activities booking/payment ledger. Contains supplier, traveler and payment metadata that must not be directly exposed through the authenticated Data API.';



CREATE TABLE IF NOT EXISTS "public"."admin_telemetry_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_type" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."admin_telemetry_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'super_admin'::"text" NOT NULL,
    CONSTRAINT "admin_users_role_check" CHECK (("role" = ANY (ARRAY['super_admin'::"text", 'operations_admin'::"text", 'curation_manager'::"text", 'marketing_manager'::"text", 'finance_manager'::"text", 'support_manager'::"text"])))
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_discovered_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "city" "text",
    "venue_name" "text",
    "venue_address" "text",
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "price" numeric,
    "currency" "text" DEFAULT 'KES'::"text",
    "image_url" "text",
    "source_url" "text",
    "source_name" "text",
    "confidence_score" integer DEFAULT 0,
    "status" "text" DEFAULT 'pending_review'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "review_score" integer,
    "image_verified" boolean DEFAULT false,
    "review_status" "text" DEFAULT 'pending_review'::"text",
    "review_notes" "text",
    "reviewed_at" timestamp with time zone,
    "experience_type" "text",
    "organizer_name" "text",
    "source_type" "text",
    "is_featured" boolean DEFAULT false,
    CONSTRAINT "ai_discovered_events_status_check" CHECK (("status" = ANY (ARRAY['pending_review'::"text", 'approved'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."ai_discovered_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_event_itineraries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "title" "text",
    "itinerary" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_event_itineraries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_sales_outreach" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prospect_id" "uuid",
    "channel" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "subject" "text",
    "approved" boolean DEFAULT false,
    "sent_at" timestamp without time zone,
    "response" "text",
    "follow_up_date" timestamp without time zone,
    "last_contacted_at" timestamp without time zone,
    "follow_up_notes" "text",
    "outcome" "text"
);


ALTER TABLE "public"."ai_sales_outreach" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_sales_prospects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_name" "text" NOT NULL,
    "category" "text",
    "city" "text",
    "website" "text",
    "instagram" "text",
    "facebook" "text",
    "contact_email" "text",
    "phone" "text",
    "source_url" "text",
    "source_name" "text",
    "description" "text",
    "opportunity_score" integer DEFAULT 0,
    "status" "text" DEFAULT 'pending_review'::"text",
    "review_status" "text" DEFAULT 'pending_review'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_sales_prospects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_scans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "location" "text" NOT NULL,
    "category" "text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text",
    "events_found" integer DEFAULT 0,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_scans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_scout_locks" (
    "lock_name" "text" NOT NULL,
    "locked_until" timestamp with time zone,
    "locked_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_scout_locks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_scout_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "location" "text" NOT NULL,
    "category" "text" NOT NULL,
    "events_found" integer DEFAULT 0,
    "status" "text" DEFAULT 'running'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "discoveries_found" integer DEFAULT 0,
    "sources_checked" integer DEFAULT 0,
    "sent_for_review" integer DEFAULT 0,
    "notes" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "queued_at" timestamp with time zone,
    "claimed_at" timestamp with time zone,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 3 NOT NULL,
    "last_error" "text",
    "provider_response_id" "text",
    "provider_status" "text",
    "worker_stage" "text",
    "poll_lease_until" timestamp with time zone,
    "provider_failure_count" integer DEFAULT 0 NOT NULL,
    "last_provider_error" "text"
);


ALTER TABLE "public"."ai_scout_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aurelian_feed_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" DEFAULT 'aurelian'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duration_ms" integer,
    "http_status" integer NOT NULL,
    "record_count" integer DEFAULT 0 NOT NULL,
    "upcoming_count" integer DEFAULT 0 NOT NULL,
    "excluded_past_count" integer DEFAULT 0 NOT NULL,
    "malformed_count" integer DEFAULT 0 NOT NULL,
    "outcome" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "aurelian_feed_runs_nonnegative_counts" CHECK ((("record_count" >= 0) AND ("upcoming_count" >= 0) AND ("excluded_past_count" >= 0) AND ("malformed_count" >= 0))),
    CONSTRAINT "aurelian_feed_runs_outcome_check" CHECK (("outcome" = ANY (ARRAY['success'::"text", 'error'::"text"]))),
    CONSTRAINT "aurelian_feed_runs_provider_check" CHECK (("provider" = 'aurelian'::"text"))
);


ALTER TABLE "public"."aurelian_feed_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_status_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "actor_id" "uuid",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."booking_status_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "public_id" "text" NOT NULL,
    "traveler_id" "uuid" NOT NULL,
    "trip_id" "uuid",
    "offering_id" "uuid",
    "event_id" "uuid",
    "provider_id" "uuid",
    "status" "text" DEFAULT 'quote'::"text" NOT NULL,
    "idempotency_key" "text",
    "supplier_amount" numeric,
    "supplier_currency" "text",
    "markup_amount" numeric DEFAULT 0 NOT NULL,
    "commission_amount" numeric DEFAULT 0 NOT NULL,
    "discount_amount" numeric DEFAULT 0 NOT NULL,
    "tax_amount" numeric DEFAULT 0 NOT NULL,
    "fee_amount" numeric DEFAULT 0 NOT NULL,
    "customer_total" numeric,
    "customer_currency" "text",
    "price_source" "text" DEFAULT 'unconfirmed_listed'::"text" NOT NULL,
    "supplier_reference" "text",
    "notes" "text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bookings_check" CHECK ((("event_id" IS NOT NULL) OR ("offering_id" IS NOT NULL))),
    CONSTRAINT "bookings_price_source_check" CHECK (("price_source" = ANY (ARRAY['unconfirmed_listed'::"text", 'safariplug_calc'::"text", 'supplier'::"text"]))),
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['search'::"text", 'availability'::"text", 'quote'::"text", 'hold'::"text", 'confirmed'::"text", 'booked'::"text", 'modified'::"text", 'cancelled'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON TABLE "public"."bookings" IS 'Booking records. Authenticated users may create quotes only. Confirm/hold/booked require a provider contract and service role.';



COMMENT ON COLUMN "public"."bookings"."price_source" IS 'unconfirmed_listed copies public event.price. It is not a supplier-confirmed rate.';



CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "business_type" "text",
    "city_id" "uuid",
    "address" "text",
    "latitude" numeric,
    "longitude" numeric,
    "phone" "text",
    "whatsapp" "text",
    "email" "text",
    "website_url" "text",
    "instagram_url" "text",
    "facebook_url" "text",
    "tiktok_url" "text",
    "logo_url" "text",
    "cover_image_url" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "claimed" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_id" "uuid",
    "supplier_contact_name" "text",
    "supplier_gallery_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "businesses_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'INACTIVE'::"text", 'SUSPENDED'::"text"])))
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "type" "text" NOT NULL,
    "icon" "text",
    "description" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "categories_type_check" CHECK (("type" = ANY (ARRAY['EVENT'::"text", 'EXPERIENCE'::"text", 'PLACE'::"text", 'PROMOTION'::"text"])))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "country" "text" NOT NULL,
    "country_code" "text",
    "slug" "text" NOT NULL,
    "latitude" numeric,
    "longitude" numeric,
    "timezone" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concierge_rate_limits" (
    "bucket" "text" NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."concierge_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prospect_id" "uuid",
    "partner_id" "uuid",
    "contact_id" "uuid",
    "activity_type" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "details" "text",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crm_activities_activity_type_check" CHECK (("activity_type" = ANY (ARRAY['research'::"text", 'note'::"text", 'call'::"text", 'email'::"text", 'whatsapp'::"text", 'meeting'::"text", 'stage_change'::"text", 'approval'::"text", 'system'::"text"]))),
    CONSTRAINT "crm_activities_check" CHECK ((("prospect_id" IS NOT NULL) OR ("partner_id" IS NOT NULL)))
);


ALTER TABLE "public"."crm_activities" OWNER TO "postgres";


COMMENT ON TABLE "public"."crm_activities" IS 'CRM 2.0 relationship timeline. Human-approved outreach and system events are recorded here.';



CREATE TABLE IF NOT EXISTS "public"."crm_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prospect_id" "uuid",
    "partner_id" "uuid",
    "full_name" "text" NOT NULL,
    "job_title" "text",
    "email" "text",
    "phone" "text",
    "linkedin_url" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "verification_status" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "source_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crm_contacts_check" CHECK ((("prospect_id" IS NOT NULL) OR ("partner_id" IS NOT NULL))),
    CONSTRAINT "crm_contacts_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['unverified'::"text", 'verified'::"text", 'invalid'::"text"])))
);


ALTER TABLE "public"."crm_contacts" OWNER TO "postgres";


COMMENT ON TABLE "public"."crm_contacts" IS 'CRM 2.0 named decision makers and verified business contacts. Admin/server managed.';



CREATE TABLE IF NOT EXISTS "public"."crm_conversions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prospect_id" "uuid",
    "partner_id" "uuid",
    "outcome" "text" NOT NULL,
    "source" "text" DEFAULT 'human'::"text" NOT NULL,
    "notes" "text",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crm_conversions_check" CHECK ((("prospect_id" IS NOT NULL) OR ("partner_id" IS NOT NULL))),
    CONSTRAINT "crm_conversions_outcome_check" CHECK (("outcome" = ANY (ARRAY['qualified'::"text", 'meeting_booked'::"text", 'proposal_sent'::"text", 'partnered'::"text", 'lost'::"text", 'disqualified'::"text"]))),
    CONSTRAINT "crm_conversions_source_check" CHECK (("source" = ANY (ARRAY['human'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."crm_conversions" OWNER TO "postgres";


COMMENT ON TABLE "public"."crm_conversions" IS 'Explicit CRM conversion outcomes. Human or deterministic system records only; AI does not declare conversion.';



CREATE TABLE IF NOT EXISTS "public"."crm_followups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prospect_id" "uuid",
    "partner_id" "uuid",
    "contact_id" "uuid",
    "title" "text" NOT NULL,
    "due_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "notes" "text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crm_followups_check" CHECK ((("prospect_id" IS NOT NULL) OR ("partner_id" IS NOT NULL))),
    CONSTRAINT "crm_followups_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text"]))),
    CONSTRAINT "crm_followups_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."crm_followups" OWNER TO "postgres";


COMMENT ON TABLE "public"."crm_followups" IS 'CRM 2.0 human-owned follow-up queue. AI may suggest next actions but does not execute outreach automatically.';



CREATE TABLE IF NOT EXISTS "public"."discoveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid",
    "source_url" "text",
    "raw_title" "text",
    "raw_content" "text",
    "extracted_data" "jsonb",
    "potential_listing_type" "text",
    "potential_category" "text",
    "discovered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duplicate_score" numeric,
    "confidence_score" numeric,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "reviewed_by" "text",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "discoveries_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'APPROVED'::"text", 'REJECTED'::"text", 'DUPLICATE'::"text", 'NEEDS_REVIEW'::"text"])))
);


ALTER TABLE "public"."discoveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "vehicle_id" "uuid",
    "status" "text" DEFAULT 'assigned'::"text" NOT NULL,
    "assigned_by" "text" DEFAULT 'system'::"text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "driver_assignments_assigned_by_check" CHECK (("assigned_by" = ANY (ARRAY['admin'::"text", 'system'::"text", 'provider'::"text"]))),
    CONSTRAINT "driver_assignments_status_check" CHECK (("status" = ANY (ARRAY['assigned'::"text", 'reassigned'::"text", 'accepted'::"text", 'declined'::"text", 'cancelled'::"text", 'released'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."driver_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."driver_assignments" IS 'Links a confirmed/booked transfer to a driver. Does not change bookings.status.';



CREATE TABLE IF NOT EXISTS "public"."driver_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "available_on" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "timezone" "text" DEFAULT 'Africa/Nairobi'::"text" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "driver_availability_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'unavailable'::"text", 'off_duty'::"text", 'assigned'::"text"])))
);


ALTER TABLE "public"."driver_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_compliance_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "vehicle_id" "uuid",
    "document_type" "text" NOT NULL,
    "expires_on" "date" NOT NULL,
    "alert_type" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "driver_compliance_alerts_alert_type_check" CHECK (("alert_type" = ANY (ARRAY['60_day'::"text", '30_day'::"text", '7_day'::"text", 'expired'::"text"]))),
    CONSTRAINT "driver_compliance_alerts_document_type_check" CHECK (("document_type" = ANY (ARRAY['driving_license'::"text", 'vehicle_registration'::"text", 'insurance'::"text"]))),
    CONSTRAINT "driver_compliance_alerts_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'acknowledged'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."driver_compliance_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid",
    "provider_type" "text" DEFAULT 'independent_driver'::"text" NOT NULL,
    "display_name" "text" NOT NULL,
    "contact_ref" "text",
    "service_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "verification_state" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "preferred" boolean DEFAULT false NOT NULL,
    "capabilities" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "service_country" "text",
    "service_region" "text",
    "service_city_id" "uuid",
    "service_city" "text",
    "service_airport_code" "text",
    "service_lat" numeric,
    "service_lng" numeric,
    "service_radius_km" numeric,
    "source" "text" DEFAULT 'safariplug'::"text" NOT NULL,
    "external_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "driving_license_path" "text",
    "driving_license_uploaded_at" timestamp with time zone,
    "driving_license_number" "text",
    "driving_license_expires_on" "date",
    "terms_accepted_at" timestamp with time zone,
    "terms_version" "text",
    "driving_license_compliance_status" "text" DEFAULT 'missing'::"text" NOT NULL,
    "personal_photo_url" "text",
    "identity_liveness_verified_at" timestamp with time zone,
    CONSTRAINT "driver_profiles_driving_license_compliance_status_check" CHECK (("driving_license_compliance_status" = ANY (ARRAY['missing'::"text", 'valid'::"text", 'expiring_soon'::"text", 'expired'::"text", 'rejected'::"text"]))),
    CONSTRAINT "driver_profiles_provider_type_check" CHECK (("provider_type" = ANY (ARRAY['independent_driver'::"text", 'safariplug_driver'::"text", 'transport_company'::"text", 'hotel_driver'::"text", 'tour_operator'::"text", 'aurelian_driver'::"text", 'external_driver_provider'::"text"]))),
    CONSTRAINT "driver_profiles_service_status_check" CHECK (("service_status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'inactive'::"text", 'suspended'::"text", 'off_duty'::"text"]))),
    CONSTRAINT "driver_profiles_verification_state_check" CHECK (("verification_state" = ANY (ARRAY['unverified'::"text", 'pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."driver_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."driver_profiles" IS 'Driver marketplace profiles. Empty until real drivers exist. verification_state cannot be verified in this phase.';



COMMENT ON COLUMN "public"."driver_profiles"."contact_ref" IS 'Opaque contact reference. Never expose through public APIs.';



COMMENT ON COLUMN "public"."driver_profiles"."personal_photo_url" IS 'Public personal profile photo for the driver. This photo is separate from private identity/liveness evidence and does not itself prove verification.';



COMMENT ON COLUMN "public"."driver_profiles"."identity_liveness_verified_at" IS 'Timestamp of the latest approved external identity + live face/liveness result. Null means the driver is not eligible to be treated as liveness-verified.';



CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid",
    "driver_id" "uuid" NOT NULL,
    "category" "text",
    "make_model" "text",
    "passenger_capacity" integer,
    "luggage_capacity" integer,
    "accessibility" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "registration_number" "text",
    "registration_expires_on" "date",
    "registration_document_path" "text",
    "registration_document_uploaded_at" timestamp with time zone,
    "insurance_policy_number" "text",
    "insurance_expires_on" "date",
    "insurance_document_path" "text",
    "insurance_document_uploaded_at" timestamp with time zone,
    "registration_compliance_status" "text" DEFAULT 'missing'::"text" NOT NULL,
    "insurance_compliance_status" "text" DEFAULT 'missing'::"text" NOT NULL,
    CONSTRAINT "vehicles_insurance_compliance_status_check" CHECK (("insurance_compliance_status" = ANY (ARRAY['missing'::"text", 'valid'::"text", 'expiring_soon'::"text", 'expired'::"text", 'rejected'::"text"]))),
    CONSTRAINT "vehicles_registration_compliance_status_check" CHECK (("registration_compliance_status" = ANY (ARRAY['missing'::"text", 'valid'::"text", 'expiring_soon'::"text", 'expired'::"text", 'rejected'::"text"]))),
    CONSTRAINT "vehicles_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'inactive'::"text", 'retired'::"text"])))
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."driver_compliance_overview" AS
 SELECT "d"."id" AS "driver_id",
    "d"."display_name",
    "d"."service_status",
    "d"."verification_state",
    "d"."driving_license_number",
    "d"."driving_license_expires_on",
        CASE
            WHEN ("d"."driving_license_expires_on" IS NULL) THEN 'missing'::"text"
            WHEN ("d"."driving_license_expires_on" < CURRENT_DATE) THEN 'expired'::"text"
            WHEN ("d"."driving_license_expires_on" <= (CURRENT_DATE + 60)) THEN 'expiring_soon'::"text"
            ELSE 'valid'::"text"
        END AS "driving_license_status",
    "v"."id" AS "vehicle_id",
    "v"."make_model",
    "v"."registration_number",
    "v"."registration_expires_on",
        CASE
            WHEN ("v"."registration_expires_on" IS NULL) THEN 'missing'::"text"
            WHEN ("v"."registration_expires_on" < CURRENT_DATE) THEN 'expired'::"text"
            WHEN ("v"."registration_expires_on" <= (CURRENT_DATE + 60)) THEN 'expiring_soon'::"text"
            ELSE 'valid'::"text"
        END AS "registration_status",
    "v"."insurance_policy_number",
    "v"."insurance_expires_on",
        CASE
            WHEN ("v"."insurance_expires_on" IS NULL) THEN 'missing'::"text"
            WHEN ("v"."insurance_expires_on" < CURRENT_DATE) THEN 'expired'::"text"
            WHEN ("v"."insurance_expires_on" <= (CURRENT_DATE + 60)) THEN 'expiring_soon'::"text"
            ELSE 'valid'::"text"
        END AS "insurance_status"
   FROM ("public"."driver_profiles" "d"
     LEFT JOIN LATERAL ( SELECT "v0"."id",
            "v0"."provider_id",
            "v0"."driver_id",
            "v0"."category",
            "v0"."make_model",
            "v0"."passenger_capacity",
            "v0"."luggage_capacity",
            "v0"."accessibility",
            "v0"."status",
            "v0"."created_at",
            "v0"."updated_at",
            "v0"."registration_number",
            "v0"."registration_expires_on",
            "v0"."registration_document_path",
            "v0"."registration_document_uploaded_at",
            "v0"."insurance_policy_number",
            "v0"."insurance_expires_on",
            "v0"."insurance_document_path",
            "v0"."insurance_document_uploaded_at",
            "v0"."registration_compliance_status",
            "v0"."insurance_compliance_status"
           FROM "public"."vehicles" "v0"
          WHERE ("v0"."driver_id" = "d"."id")
          ORDER BY "v0"."created_at" DESC
         LIMIT 1) "v" ON (true));


ALTER VIEW "public"."driver_compliance_overview" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_transfer_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "rate_type" "text" NOT NULL,
    "origin_label" "text",
    "destination_label" "text",
    "airport_code" "text",
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'KES'::"text" NOT NULL,
    "included_km" numeric(10,2),
    "extra_km_amount" numeric(12,2),
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "driver_transfer_rates_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "driver_transfer_rates_rate_type_check" CHECK (("rate_type" = ANY (ARRAY['flat_route'::"text", 'airport_transfer'::"text", 'hourly'::"text", 'daily'::"text"]))),
    CONSTRAINT "driver_transfer_rates_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."driver_transfer_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "city_id" "uuid" NOT NULL,
    "venue_name" "text",
    "venue_address" "text",
    "category" "text" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone,
    "price" numeric(12,2),
    "currency" "text" DEFAULT 'KES'::"text",
    "image_url" "text",
    "booking_url" "text",
    "source_url" "text",
    "organizer_name" "text",
    "organizer_contact" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "latitude" double precision,
    "longitude" double precision,
    "organizer_id" "uuid",
    "source_type" "text" DEFAULT 'AI_SCOUT'::"text",
    "submitted_by" "uuid",
    "verified" boolean DEFAULT false,
    "ai_confidence" numeric,
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "experience_type" "text",
    "is_featured" boolean DEFAULT false,
    CONSTRAINT "events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_delivery_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "vehicle_id" "uuid",
    "assignment_source" "text" DEFAULT 'safariplug'::"text" NOT NULL,
    "status" "text" DEFAULT 'assigned'::"text" NOT NULL,
    "delivery_fee" numeric(12,2) DEFAULT 0 NOT NULL,
    "assigned_by" "uuid",
    "accepted_at" timestamp with time zone,
    "picked_up_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "arrived_at" timestamp with time zone,
    "customer_rating" integer,
    "customer_note" "text",
    CONSTRAINT "food_delivery_assignment_source" CHECK (("assignment_source" = ANY (ARRAY['safariplug'::"text", 'customer'::"text", 'restaurant'::"text"]))),
    CONSTRAINT "food_delivery_assignment_status" CHECK (("status" = ANY (ARRAY['assigned'::"text", 'accepted'::"text", 'declined'::"text", 'arrived_at_restaurant'::"text", 'picked_up'::"text", 'on_the_way'::"text", 'delivered'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."food_delivery_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_order_item_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "option_name" "text" NOT NULL,
    "value_name" "text" NOT NULL,
    "price_delta" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."food_order_item_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "menu_item_id" "uuid",
    "item_name" "text" NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "quantity" integer NOT NULL,
    "line_total" numeric(12,2) NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "food_order_items_quantity_positive" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."food_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_order_payment_idempotency" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "customer_user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "payment_intent_id" "text" NOT NULL,
    "provider_reference" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processing_until" timestamp with time zone,
    "provider_submission_state" "text" DEFAULT 'ready'::"text" NOT NULL,
    "attempt_active" boolean DEFAULT false NOT NULL,
    CONSTRAINT "food_order_payment_idempotency_submission_state_check" CHECK (("provider_submission_state" = ANY (ARRAY['ready'::"text", 'submitted'::"text", 'uncertain'::"text"])))
);


ALTER TABLE "public"."food_order_payment_idempotency" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_order_refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "provider_reference" "text",
    "refund_reference" "text",
    "requested_by" "uuid",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "food_order_refunds_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "food_order_refunds_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'succeeded'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."food_order_refunds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "public_id" "text" DEFAULT ('FOOD-'::"text" || "upper"("substr"("replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text"), 1, 10))) NOT NULL,
    "business_id" "uuid" NOT NULL,
    "customer_user_id" "uuid",
    "customer_name" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "customer_email" "text",
    "fulfillment_method" "text" DEFAULT 'pickup'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "payment_reference" "text",
    "currency" "text" DEFAULT 'KES'::"text" NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "delivery_fee" numeric(12,2) DEFAULT 0 NOT NULL,
    "service_fee" numeric(12,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "customer_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "pickup_address" "text",
    "delivery_address" "text",
    "delivery_latitude" numeric,
    "delivery_longitude" numeric,
    "customer_notes" "text",
    "restaurant_notes" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "ready_at" timestamp with time zone,
    "picked_up_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "estimated_prep_minutes" integer,
    "estimated_delivery_minutes" integer,
    "eta_at" timestamp with time zone,
    "accepted_by" "uuid",
    "payment_intent_id" "text",
    "cancellation_reason" "text",
    "trip_id" "uuid",
    "customer_rating" integer,
    "customer_note" "text",
    "refunded_amount" numeric DEFAULT 0 NOT NULL,
    "refund_reference" "text",
    "refunded_at" timestamp with time zone,
    CONSTRAINT "food_orders_customer_rating_check" CHECK ((("customer_rating" IS NULL) OR (("customer_rating" >= 1) AND ("customer_rating" <= 5)))),
    CONSTRAINT "food_orders_fulfillment_method" CHECK (("fulfillment_method" = ANY (ARRAY['pickup'::"text", 'safari_driver'::"text", 'customer_driver'::"text", 'restaurant_delivery'::"text"]))),
    CONSTRAINT "food_orders_payment_status" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text", 'disputed'::"text"]))),
    CONSTRAINT "food_orders_refunded_amount_nonnegative" CHECK (("refunded_amount" >= (0)::numeric)),
    CONSTRAINT "food_orders_refunded_amount_not_over_total" CHECK (("refunded_amount" <= "customer_total")),
    CONSTRAINT "food_orders_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'preparing'::"text", 'ready'::"text", 'driver_assigned'::"text", 'picked_up'::"text", 'on_the_way'::"text", 'delivered'::"text", 'cancelled'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."food_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hotel_booking_pricing_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'locktrip'::"text" NOT NULL,
    "quote_id" "text",
    "prepared_booking_id" "text",
    "provider_booking_reference" "text",
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "supplier_net_amount" numeric(12,2) NOT NULL,
    "retail_amount" numeric(12,2) NOT NULL,
    "markup_percent" numeric(6,2) DEFAULT 10 NOT NULL,
    "payment_provider" "text",
    "payment_reference" "text",
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "booking_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "supplier_settlement_status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "supplier_currency" "text",
    "customer_currency" "text",
    "exchange_rate" numeric(20,10),
    "customer_retail_amount" numeric(14,2),
    "checkout_intent_key" "text",
    "payment_initiation_started_at" timestamp with time zone,
    CONSTRAINT "hotel_booking_pricing_ledger_booking_status_check" CHECK (("booking_status" = ANY (ARRAY['pending'::"text", 'prepared'::"text", 'payment_pending'::"text", 'confirmed'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "hotel_booking_pricing_ledger_check" CHECK (("retail_amount" >= "supplier_net_amount")),
    CONSTRAINT "hotel_booking_pricing_ledger_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "hotel_booking_pricing_ledger_supplier_net_amount_check" CHECK (("supplier_net_amount" >= (0)::numeric)),
    CONSTRAINT "hotel_booking_pricing_ledger_supplier_settlement_status_check" CHECK (("supplier_settlement_status" = ANY (ARRAY['not_started'::"text", 'pending'::"text", 'settled'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."hotel_booking_pricing_ledger" OWNER TO "postgres";


COMMENT ON COLUMN "public"."hotel_booking_pricing_ledger"."checkout_intent_key" IS 'Stable client checkout key used to reuse one governed hotel checkout attempt.';



COMMENT ON COLUMN "public"."hotel_booking_pricing_ledger"."payment_initiation_started_at" IS 'Set before outbound M-Pesa submission to prevent concurrent duplicate STK pushes.';



CREATE TABLE IF NOT EXISTS "public"."hotel_checkout_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "intent_key" "text" NOT NULL,
    "state" "text" DEFAULT 'initialized'::"text" NOT NULL,
    "prepared_booking_id" "text",
    "ledger_id" "uuid",
    "supplier_prepare_started_at" timestamp with time zone,
    "payment_initiation_started_at" timestamp with time zone,
    "last_error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hotel_checkout_intents_state_check" CHECK (("state" = ANY (ARRAY['initialized'::"text", 'supplier_preparing'::"text", 'supplier_prepared'::"text", 'payment_initializing'::"text", 'payment_pending'::"text", 'payment_indeterminate'::"text", 'supplier_prepare_indeterminate'::"text", 'failed'::"text", 'confirmed'::"text"])))
);


ALTER TABLE "public"."hotel_checkout_intents" OWNER TO "postgres";


COMMENT ON TABLE "public"."hotel_checkout_intents" IS 'Server-only hotel checkout idempotency coordinator. Prevents duplicate supplier preparation and M-Pesa initiation across repeated or concurrent checkout requests.';



CREATE TABLE IF NOT EXISTS "public"."hotelbeds_content_sync_state" (
    "sync_key" "text" NOT NULL,
    "next_from" integer DEFAULT 1 NOT NULL,
    "page_size" integer DEFAULT 1000 NOT NULL,
    "language" "text" DEFAULT 'ENG'::"text" NOT NULL,
    "incremental_since" "text",
    "supplier_total" integer,
    "last_page_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'idle'::"text" NOT NULL,
    "last_error" "text",
    "last_started_at" timestamp with time zone,
    "last_completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hotelbeds_content_sync_state_next_from_check" CHECK (("next_from" >= 1)),
    CONSTRAINT "hotelbeds_content_sync_state_page_size_check" CHECK ((("page_size" >= 1) AND ("page_size" <= 1000))),
    CONSTRAINT "hotelbeds_content_sync_state_status_check" CHECK (("status" = ANY (ARRAY['idle'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."hotelbeds_content_sync_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hotelbeds_hotel_content" (
    "hotel_code" bigint NOT NULL,
    "language" "text" DEFAULT 'ENG'::"text" NOT NULL,
    "name" "text",
    "destination_code" "text",
    "destination_name" "text",
    "country_code" "text",
    "category_code" "text",
    "category_name" "text",
    "address" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "coordinates" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "descriptions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "images" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "facilities" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "rooms" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "supplier_last_update" "text",
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hotelbeds_hotel_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_syncs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" NOT NULL,
    "safariplug_event_id" "uuid" NOT NULL,
    "external_id" "text",
    "sync_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "last_synced_at" timestamp with time zone,
    "last_error" "text",
    "last_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "integration_syncs_sync_status_check" CHECK (("sync_status" = ANY (ARRAY['pending'::"text", 'synced'::"text", 'error'::"text", 'skipped'::"text", 'not_configured'::"text"])))
);


ALTER TABLE "public"."integration_syncs" OWNER TO "postgres";


COMMENT ON TABLE "public"."integration_syncs" IS 'Tracks SafariPlug event sync state to external partners. No public policies; server uses service role after admin auth.';



CREATE TABLE IF NOT EXISTS "public"."inventory_kinds" (
    "slug" "text" NOT NULL,
    "label" "text" NOT NULL,
    "group_name" "text" NOT NULL
);


ALTER TABLE "public"."inventory_kinds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "excerpt" "text",
    "body" "text" NOT NULL,
    "meta_title" "text",
    "meta_description" "text",
    "image_url" "text",
    "category" "text",
    "city" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_event_id" "uuid",
    CONSTRAINT "journal_articles_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text"])))
);


ALTER TABLE "public"."journal_articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "listing_type" "text" NOT NULL,
    "description" "text",
    "short_description" "text",
    "city_id" "uuid",
    "category_id" "uuid",
    "business_id" "uuid",
    "venue_name" "text",
    "address" "text",
    "latitude" numeric,
    "longitude" numeric,
    "start_date" "date",
    "end_date" "date",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "is_recurring" boolean DEFAULT false NOT NULL,
    "recurrence_rule" "text",
    "price_from" numeric,
    "price_to" numeric,
    "currency" "text" DEFAULT 'KES'::"text",
    "price_type" "text",
    "booking_url" "text",
    "website_url" "text",
    "whatsapp_number" "text",
    "image_url" "text",
    "source_url" "text",
    "source_name" "text",
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "verification_status" "text" DEFAULT 'UNVERIFIED'::"text" NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "featured_until" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "listings_listing_type_check" CHECK (("listing_type" = ANY (ARRAY['EVENT'::"text", 'EXPERIENCE'::"text", 'PLACE'::"text"]))),
    CONSTRAINT "listings_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'PENDING'::"text", 'PUBLISHED'::"text", 'REJECTED'::"text", 'CANCELLED'::"text", 'EXPIRED'::"text"]))),
    CONSTRAINT "listings_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['UNVERIFIED'::"text", 'PENDING'::"text", 'VERIFIED'::"text"])))
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."local_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_id" "uuid" NOT NULL,
    "available_on" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "timezone" "text" DEFAULT 'Africa/Nairobi'::"text" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "local_availability_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'unavailable'::"text"])))
);


ALTER TABLE "public"."local_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."local_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "bio" "text",
    "personal_photo_url" "text",
    "city" "text",
    "country" "text",
    "languages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "interests" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "specialties" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "hourly_rate" numeric(12,2),
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "timezone" "text" DEFAULT 'Africa/Nairobi'::"text" NOT NULL,
    "verification_state" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "service_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "terms_accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "identity_liveness_verified_at" timestamp with time zone,
    CONSTRAINT "local_profiles_rate_nonnegative" CHECK ((("hourly_rate" IS NULL) OR ("hourly_rate" >= (0)::numeric))),
    CONSTRAINT "local_profiles_service_status_check" CHECK (("service_status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'active'::"text", 'paused'::"text", 'suspended'::"text"]))),
    CONSTRAINT "local_profiles_verification_state_check" CHECK (("verification_state" = ANY (ARRAY['unverified'::"text", 'pending'::"text", 'verified'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."local_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."local_profiles"."identity_liveness_verified_at" IS 'Timestamp of latest approved external identity + live face/liveness verification. Public photo alone is not verification.';



CREATE TABLE IF NOT EXISTS "public"."local_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "traveler_id" "uuid" NOT NULL,
    "local_id" "uuid" NOT NULL,
    "trip_id" "uuid",
    "requested_start_at" timestamp with time zone NOT NULL,
    "requested_end_at" timestamp with time zone,
    "city" "text",
    "activity" "text",
    "notes" "text",
    "quoted_amount" numeric(12,2),
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "local_requests_quote_nonnegative" CHECK ((("quoted_amount" IS NULL) OR ("quoted_amount" >= (0)::numeric))),
    CONSTRAINT "local_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'accepted'::"text", 'declined'::"text", 'cancelled'::"text", 'completed'::"text"]))),
    CONSTRAINT "local_requests_time_order" CHECK ((("requested_end_at" IS NULL) OR ("requested_end_at" > "requested_start_at")))
);


ALTER TABLE "public"."local_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_drafts" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_id" "uuid",
    "event_name" "text",
    "city" "text",
    "platform" "text",
    "content_type" "text",
    "draft_content" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "publish_status" "text" DEFAULT 'not_ready'::"text",
    "approved_at" timestamp with time zone,
    "approved_by" "text",
    "scheduled_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "image_url" "text",
    "video_url" "text",
    "external_url" "text",
    "metricool_post_id" "text",
    "metricool_status" "text",
    "publish_error" "text",
    "creative_brief" "text",
    "video_job_id" "text",
    "video_status" "text",
    "video_prompt" "text",
    "video_error" "text"
);


ALTER TABLE "public"."marketing_drafts" OWNER TO "postgres";


ALTER TABLE "public"."marketing_drafts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."marketing_drafts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."offerings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kind" "text" NOT NULL,
    "provider_id" "uuid",
    "event_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "city_id" "uuid",
    "category" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "source" "text" DEFAULT 'safariplug'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "offerings_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'approved'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."offerings" OWNER TO "postgres";


COMMENT ON TABLE "public"."offerings" IS 'Provider inventory. Empty until real providers exist. Linking an event does not publish or book it.';



CREATE TABLE IF NOT EXISTS "public"."partner_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_name" "text" NOT NULL,
    "partner_type" "text" NOT NULL,
    "contact_email" "text",
    "whatsapp_phone" "text",
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "invitation_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ai_subject" "text",
    "ai_message" "text",
    "approved_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "opened_at" timestamp with time zone,
    "signup_started_at" timestamp with time zone,
    "onboarded_user_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "prospect_id" "uuid",
    "partner_id" "uuid",
    "contact_id" "uuid",
    CONSTRAINT "partner_invitation_contact" CHECK ((("contact_email" IS NOT NULL) OR ("whatsapp_phone" IS NOT NULL))),
    CONSTRAINT "partner_invitations_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'whatsapp'::"text", 'both'::"text"]))),
    CONSTRAINT "partner_invitations_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'ready_for_approval'::"text", 'approved'::"text", 'sent'::"text", 'opened'::"text", 'signup_started'::"text", 'onboarding'::"text", 'active'::"text", 'declined'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."partner_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."partner_invitations" IS 'Admin-governed partner recruitment invitations. AI drafts only; sending requires explicit approval. WhatsApp delivery must use a configured real provider.';



COMMENT ON COLUMN "public"."partner_invitations"."prospect_id" IS 'Optional originating AI sales prospect for governed outreach context.';



COMMENT ON COLUMN "public"."partner_invitations"."partner_id" IS 'Optional enrolled SafariPlug partner associated with the invitation.';



COMMENT ON COLUMN "public"."partner_invitations"."contact_id" IS 'Optional CRM contact selected by a human for the invitation.';



CREATE TABLE IF NOT EXISTS "public"."price_quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "offering_id" "uuid",
    "booking_id" "uuid",
    "supplier_amount" numeric NOT NULL,
    "supplier_currency" "text" NOT NULL,
    "markup_amount" numeric DEFAULT 0 NOT NULL,
    "commission_amount" numeric DEFAULT 0 NOT NULL,
    "discount_amount" numeric DEFAULT 0 NOT NULL,
    "tax_amount" numeric DEFAULT 0 NOT NULL,
    "fee_amount" numeric DEFAULT 0 NOT NULL,
    "customer_total" numeric NOT NULL,
    "customer_currency" "text" NOT NULL,
    "source" "text" DEFAULT 'unconfirmed_listed'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."price_quotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "user_type" "text" DEFAULT 'user'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "email" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promotions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "business_id" "uuid",
    "city_id" "uuid",
    "category_id" "uuid",
    "original_price" numeric,
    "promotional_price" numeric,
    "currency" "text" DEFAULT 'KES'::"text",
    "discount_percentage" numeric,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "terms" "text",
    "booking_url" "text",
    "website_url" "text",
    "whatsapp_number" "text",
    "image_url" "text",
    "source_url" "text",
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "featured_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "promotions_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'PENDING'::"text", 'PUBLISHED'::"text", 'REJECTED'::"text", 'EXPIRED'::"text"])))
);


ALTER TABLE "public"."promotions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "kind" "text" DEFAULT 'business'::"text" NOT NULL,
    "provider_type" "text" DEFAULT 'other'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "verification_status" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "city_id" "uuid",
    "location_label" "text",
    "service_area" "text",
    "capabilities" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "external_id" "text",
    "source" "text" DEFAULT 'safariplug'::"text" NOT NULL,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "providers_kind_check" CHECK (("kind" = ANY (ARRAY['business'::"text", 'individual'::"text"]))),
    CONSTRAINT "providers_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'active'::"text", 'suspended'::"text", 'archived'::"text"]))),
    CONSTRAINT "providers_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['unverified'::"text", 'pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_notification_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "expo_push_token" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "device_name" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "push_notification_tokens_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text", 'web'::"text"])))
);


ALTER TABLE "public"."push_notification_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_menu_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."restaurant_menu_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_menu_item_option_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "option_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price_delta" numeric(12,2) DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."restaurant_menu_item_option_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_menu_item_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "required" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."restaurant_menu_item_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "price" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'KES'::"text" NOT NULL,
    "preparation_time_minutes" integer,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "available" boolean DEFAULT true NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "restaurant_menu_items_price_nonnegative" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."restaurant_menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "ordering_enabled" boolean DEFAULT false NOT NULL,
    "pickup_enabled" boolean DEFAULT true NOT NULL,
    "safari_driver_enabled" boolean DEFAULT false NOT NULL,
    "customer_driver_enabled" boolean DEFAULT true NOT NULL,
    "restaurant_delivery_enabled" boolean DEFAULT false NOT NULL,
    "restaurant_delivery_fee" numeric(12,2) DEFAULT 0 NOT NULL,
    "free_delivery_threshold" numeric(12,2),
    "minimum_order_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "preparation_time_minutes" integer DEFAULT 30 NOT NULL,
    "ordering_notice_minutes" integer DEFAULT 0 NOT NULL,
    "timezone" "text" DEFAULT 'Africa/Nairobi'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "safari_driver_base_fee" numeric DEFAULT 150 NOT NULL,
    "safari_driver_per_km" numeric DEFAULT 30 NOT NULL,
    "customer_driver_base_fee" numeric DEFAULT 150 NOT NULL,
    "customer_driver_per_km" numeric DEFAULT 30 NOT NULL,
    CONSTRAINT "restaurant_settings_fees_nonnegative" CHECK ((("restaurant_delivery_fee" >= (0)::numeric) AND ("minimum_order_amount" >= (0)::numeric))),
    CONSTRAINT "restaurant_settings_prep_positive" CHECK (("preparation_time_minutes" > 0))
);


ALTER TABLE "public"."restaurant_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."safari_partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "venue_or_promoter_name" "text" NOT NULL,
    "contact_person" "text",
    "email_or_phone" "text",
    "instagram_handle" "text",
    "outreach_stage" "text" DEFAULT 'prospect'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."safari_partners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "traveler_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."saved_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scout_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" DEFAULT 'queued'::"text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "discoveries_found" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scout_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_appointment_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "status" "text" DEFAULT 'unread'::"text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_appointment_notifications_status_check" CHECK (("status" = ANY (ARRAY['unread'::"text", 'read'::"text"])))
);


ALTER TABLE "public"."service_appointment_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_appointment_status_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "actor_type" "text" NOT NULL,
    "actor_user_id" "uuid",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_appointment_status_events_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['customer'::"text", 'provider'::"text", 'admin'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."service_appointment_status_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_categories_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_offerings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_profile_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "duration_minutes" integer NOT NULL,
    "price" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'KES'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "requires_confirmation" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_offerings_duration_minutes_check" CHECK ((("duration_minutes" >= 5) AND ("duration_minutes" <= 1440))),
    CONSTRAINT "service_offerings_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "service_offerings_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."service_offerings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_payment_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "event_type" "text",
    "appointment_id" "uuid",
    "provider_reference" "text",
    "status" "text" DEFAULT 'received'::"text" NOT NULL,
    "error_message" "text",
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "service_payment_events_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'processed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."service_payment_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_payment_idempotency" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "customer_user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "payment_intent_id" "text",
    "provider_reference" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processing_until" timestamp with time zone,
    "provider_submission_state" "text" DEFAULT 'ready'::"text" NOT NULL,
    "attempt_active" boolean DEFAULT false NOT NULL,
    CONSTRAINT "service_payment_idempotency_provider_submission_state_check" CHECK (("provider_submission_state" = ANY (ARRAY['ready'::"text", 'submitted'::"text", 'uncertain'::"text"])))
);


ALTER TABLE "public"."service_payment_idempotency" OWNER TO "postgres";


COMMENT ON COLUMN "public"."service_payment_idempotency"."attempt_active" IS 'True while this row owns the only active external payment attempt for the appointment/provider. Cleared after a confirmed failed/cancelled provider result so a governed retry can start.';



CREATE TABLE IF NOT EXISTS "public"."service_payment_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "provider_reference" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'received'::"text" NOT NULL,
    "error_message" "text",
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_payment_webhook_events_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'mpesa'::"text", 'paystack'::"text", 'flutterwave'::"text", 'manual'::"text"]))),
    CONSTRAINT "service_payment_webhook_events_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'processed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."service_payment_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "booking_status" "text" DEFAULT 'closed'::"text" NOT NULL,
    "timezone" "text" DEFAULT 'Africa/Nairobi'::"text" NOT NULL,
    "cancellation_policy" "text",
    "booking_notice_minutes" integer DEFAULT 60 NOT NULL,
    "max_booking_days" integer DEFAULT 90 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider_terms_version" "text",
    "provider_terms_accepted_at" timestamp with time zone,
    "provider_terms_accepted_by" "uuid",
    "service_fee_percent" numeric(5,2) DEFAULT 10.00 NOT NULL,
    "service_fee_minimum" numeric(12,2) DEFAULT 30.00 NOT NULL,
    "customer_fee_percent" numeric(5,2) DEFAULT 0.00 NOT NULL,
    "customer_fee_minimum" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "customer_fee_maximum" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "payout_minimum" numeric(12,2) DEFAULT 1000.00 NOT NULL,
    "payout_schedule" "text" DEFAULT 'weekly'::"text" NOT NULL,
    "notification_email" boolean DEFAULT true NOT NULL,
    "notification_whatsapp" boolean DEFAULT true NOT NULL,
    CONSTRAINT "service_profiles_booking_notice_minutes_check" CHECK (("booking_notice_minutes" >= 0)),
    CONSTRAINT "service_profiles_booking_status_check" CHECK (("booking_status" = ANY (ARRAY['closed'::"text", 'open'::"text", 'paused'::"text"]))),
    CONSTRAINT "service_profiles_fee_bounds" CHECK (((("service_fee_percent" >= (0)::numeric) AND ("service_fee_percent" <= (100)::numeric)) AND ("service_fee_minimum" >= (0)::numeric) AND (("customer_fee_percent" >= (0)::numeric) AND ("customer_fee_percent" <= (100)::numeric)) AND ("customer_fee_minimum" >= (0)::numeric) AND ("customer_fee_maximum" >= "customer_fee_minimum") AND ("payout_minimum" >= (0)::numeric))),
    CONSTRAINT "service_profiles_max_booking_days_check" CHECK (("max_booking_days" > 0)),
    CONSTRAINT "service_profiles_service_fee_percent_check" CHECK ((("service_fee_percent" >= (0)::numeric) AND ("service_fee_percent" <= (100)::numeric))),
    CONSTRAINT "service_profiles_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'inactive'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."service_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_provider_payout_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'mpesa_b2c'::"text" NOT NULL,
    "phone" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_provider_payout_accounts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text", 'disabled'::"text"])))
);


ALTER TABLE "public"."service_provider_payout_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_profile_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "display_name" "text" NOT NULL,
    "bio" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "personal_photo_url" "text",
    "verification_state" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "identity_liveness_verified_at" timestamp with time zone,
    CONSTRAINT "service_staff_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"]))),
    CONSTRAINT "service_staff_verification_state_check" CHECK (("verification_state" = ANY (ARRAY['unverified'::"text", 'pending'::"text", 'verified'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."service_staff" OWNER TO "postgres";


COMMENT ON COLUMN "public"."service_staff"."personal_photo_url" IS 'Personal profile photo for the individual service provider. A photo alone does not imply identity verification.';



COMMENT ON COLUMN "public"."service_staff"."identity_liveness_verified_at" IS 'Timestamp of latest approved external identity + live face/liveness result for this individual specialist.';



CREATE TABLE IF NOT EXISTS "public"."service_staff_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "service_staff_availability_check" CHECK (("end_time" > "start_time")),
    CONSTRAINT "service_staff_availability_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."service_staff_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_staff_blockouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "reason" "text",
    CONSTRAINT "service_staff_blockouts_check" CHECK (("ends_at" > "starts_at"))
);


ALTER TABLE "public"."service_staff_blockouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_staff_claim_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_staff_claim_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_staff_offerings" (
    "staff_id" "uuid" NOT NULL,
    "offering_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_staff_offerings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "url" "text" NOT NULL,
    "city_id" "uuid",
    "active" boolean DEFAULT true NOT NULL,
    "last_checked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sources_source_type_check" CHECK (("source_type" = ANY (ARRAY['WEBSITE'::"text", 'INSTAGRAM'::"text", 'FACEBOOK'::"text", 'TIKTOK'::"text", 'EVENT_PLATFORM'::"text", 'VENUE'::"text", 'HOTEL'::"text", 'RESTAURANT'::"text", 'TOUR_OPERATOR'::"text", 'OTHER'::"text"])))
);


ALTER TABLE "public"."sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_id" "uuid" NOT NULL,
    "contact_name" "text" NOT NULL,
    "invitation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "onboarding_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "completion_percent" integer DEFAULT 0 NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "submitted_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "review_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "review_note" "text",
    "review_requested_at" timestamp with time zone,
    "prospect_id" "uuid",
    "partner_id" "uuid",
    CONSTRAINT "supplier_accounts_completion_percent_check" CHECK ((("completion_percent" >= 0) AND ("completion_percent" <= 100))),
    CONSTRAINT "supplier_accounts_invitation_status_check" CHECK (("invitation_status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "supplier_accounts_onboarding_status_check" CHECK (("onboarding_status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'changes_requested'::"text", 'approved'::"text", 'rejected'::"text", 'live'::"text"])))
);


ALTER TABLE "public"."supplier_accounts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."supplier_accounts"."review_items" IS 'Structured human-requested onboarding fixes shown back to the supplier.';



COMMENT ON COLUMN "public"."supplier_accounts"."review_note" IS 'Optional human review note sent with requested onboarding changes.';



COMMENT ON COLUMN "public"."supplier_accounts"."review_requested_at" IS 'When SafariPlug staff last requested onboarding changes.';



COMMENT ON COLUMN "public"."supplier_accounts"."prospect_id" IS 'Stable optional link to the AI Sales prospect that originated this supplier relationship.';



COMMENT ON COLUMN "public"."supplier_accounts"."partner_id" IS 'Stable optional link to the SafariPlug partner CRM relationship for this enrolled supplier.';



CREATE TABLE IF NOT EXISTS "public"."supplier_followup_prep_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" NOT NULL,
    "checked_count" integer DEFAULT 0 NOT NULL,
    "prepared_count" integer DEFAULT 0 NOT NULL,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supplier_followup_prep_runs_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."supplier_followup_prep_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_onboarding_followup_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "missing_requirements" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "comparison" "jsonb",
    "status" "text" DEFAULT 'prepared'::"text" NOT NULL,
    "prepared_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supplier_onboarding_followup_drafts_status_check" CHECK (("status" = ANY (ARRAY['prepared'::"text", 'used'::"text", 'superseded'::"text"])))
);


ALTER TABLE "public"."supplier_onboarding_followup_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_onboarding_followups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "missing_requirements" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "next_followup_due_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supplier_onboarding_followups_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."supplier_onboarding_followups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transfer_booking_pricing_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'hotelbeds'::"text" NOT NULL,
    "prepared_booking_id" "text" NOT NULL,
    "provider_booking_reference" "text",
    "supplier_currency" "text" NOT NULL,
    "customer_currency" "text" NOT NULL,
    "exchange_rate" numeric(20,10),
    "supplier_amount" numeric(14,2) NOT NULL,
    "retail_amount" numeric(14,2) NOT NULL,
    "markup_percent" numeric(6,3) DEFAULT 10 NOT NULL,
    "payment_provider" "text",
    "payment_reference" "text",
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "booking_status" "text" DEFAULT 'payment_pending'::"text" NOT NULL,
    "supplier_settlement_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checkout_intent_key" "text",
    "payment_initiation_started_at" timestamp with time zone,
    CONSTRAINT "transfer_booking_pricing_ledge_supplier_settlement_status_check" CHECK (("supplier_settlement_status" = ANY (ARRAY['pending'::"text", 'settled'::"text", 'failed'::"text"]))),
    CONSTRAINT "transfer_booking_pricing_ledger_amounts" CHECK (("retail_amount" >= (0)::numeric)),
    CONSTRAINT "transfer_booking_pricing_ledger_booking_status_check" CHECK (("booking_status" = ANY (ARRAY['payment_pending'::"text", 'confirmed'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "transfer_booking_pricing_ledger_markup_percent_check" CHECK (("markup_percent" >= (0)::numeric)),
    CONSTRAINT "transfer_booking_pricing_ledger_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "transfer_booking_pricing_ledger_retail_amount_check" CHECK (("retail_amount" >= (0)::numeric)),
    CONSTRAINT "transfer_booking_pricing_ledger_supplier_amount_check" CHECK (("supplier_amount" >= (0)::numeric))
);


ALTER TABLE "public"."transfer_booking_pricing_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."transfer_booking_pricing_ledger" IS 'Server-only governed Hotelbeds Transfers booking/payment ledger. Contains supplier and payment metadata that must not be directly exposed through the authenticated Data API.';



CREATE TABLE IF NOT EXISTS "public"."travel_refund_review_events" (
    "id" bigint NOT NULL,
    "review_id" "uuid" NOT NULL,
    "product" "text" NOT NULL,
    "ledger_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "from_resolution" "text",
    "to_resolution" "text",
    "actor_user_id" "uuid",
    "notes_snapshot" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "travel_refund_review_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['created'::"text", 'review_started'::"text", 'resolved'::"text", 'updated'::"text", 'reopened'::"text"])))
);


ALTER TABLE "public"."travel_refund_review_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."travel_refund_review_events" IS 'Append-only server-side event history for governed refund/reconciliation review decisions. This table records review state changes only and never moves money.';



ALTER TABLE "public"."travel_refund_review_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."travel_refund_review_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."travel_refund_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product" "text" NOT NULL,
    "ledger_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "resolution" "text",
    "notes" "text",
    "assigned_to" "uuid",
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "travel_refund_reviews_product_check" CHECK (("product" = ANY (ARRAY['hotel'::"text", 'transfer'::"text", 'activity'::"text", 'service'::"text", 'food'::"text"]))),
    CONSTRAINT "travel_refund_reviews_resolution_check" CHECK ((("resolution" IS NULL) OR ("resolution" = ANY (ARRAY['refund_required'::"text", 'no_refund_due'::"text", 'refunded_externally'::"text"])))),
    CONSTRAINT "travel_refund_reviews_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_review'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."travel_refund_reviews" OWNER TO "postgres";


COMMENT ON TABLE "public"."travel_refund_reviews" IS 'Server-only finance review workflow for travel, service and food-order cases that may require customer refund/reconciliation review. Review state only; does not move money or alter payment truth.';



CREATE TABLE IF NOT EXISTS "public"."trip_package_checkout_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "traveler_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'checking'::"text" NOT NULL,
    "currency" "text" NOT NULL,
    "subtotal" numeric(14,2) NOT NULL,
    "component_count" integer DEFAULT 0 NOT NULL,
    "component_checks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "hold_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_package_checkout_attempts_component_count_check" CHECK (("component_count" >= 0)),
    CONSTRAINT "trip_package_checkout_attempts_status_check" CHECK (("status" = ANY (ARRAY['checking'::"text", 'ready'::"text", 'confirmation_required'::"text", 'blocked'::"text", 'expired'::"text"]))),
    CONSTRAINT "trip_package_checkout_attempts_subtotal_check" CHECK (("subtotal" >= (0)::numeric))
);


ALTER TABLE "public"."trip_package_checkout_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."trip_package_checkout_attempts" IS 'Checkout-readiness audit snapshots. A ready row means recorded components passed SafariPlug checks; it does not mean payment, supplier hold, or confirmed booking.';



CREATE TABLE IF NOT EXISTS "public"."trip_package_payment_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "checkout_attempt_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "traveler_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "currency" "text" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "status" "text" DEFAULT 'created'::"text" NOT NULL,
    "provider_reference" "text",
    "provider_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_package_payment_intents_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "trip_package_payment_intents_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'mpesa'::"text"]))),
    CONSTRAINT "trip_package_payment_intents_status_check" CHECK (("status" = ANY (ARRAY['created'::"text", 'provider_not_configured'::"text", 'requires_action'::"text", 'processing'::"text", 'succeeded'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."trip_package_payment_intents" OWNER TO "postgres";


COMMENT ON TABLE "public"."trip_package_payment_intents" IS 'Package payment orchestration records. Creating an intent does not mean money was charged or any trip component was confirmed.';



CREATE TABLE IF NOT EXISTS "public"."trip_package_quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "traveler_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "currency" "text" NOT NULL,
    "subtotal" numeric(14,2) NOT NULL,
    "component_count" integer DEFAULT 0 NOT NULL,
    "components" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "pricing_basis" "text" DEFAULT 'recorded_components'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_package_quotes_component_count_check" CHECK (("component_count" >= 0)),
    CONSTRAINT "trip_package_quotes_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'ready'::"text", 'expired'::"text", 'accepted'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "trip_package_quotes_subtotal_check" CHECK (("subtotal" >= (0)::numeric))
);


ALTER TABLE "public"."trip_package_quotes" OWNER TO "postgres";


COMMENT ON TABLE "public"."trip_package_quotes" IS 'Snapshots of real SafariPlug trip price components. A quote does not imply supplier availability, payment, hold, or booking confirmation.';



CREATE TABLE IF NOT EXISTS "public"."trips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "traveler_id" "uuid" NOT NULL,
    "title" "text",
    "destination_city_id" "uuid",
    "start_on" "date",
    "end_on" "date",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cover_image_url" "text",
    "share_token" "text",
    CONSTRAINT "trips_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'planned'::"text", 'booked'::"text", 'active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."trips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verification_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject_type" "text" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "verification_level" "text" DEFAULT 'basic'::"text" NOT NULL,
    "provider" "text" DEFAULT 'human_review'::"text" NOT NULL,
    "external_id" "text",
    "reviewed_by" "text",
    "reviewed_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "rejection_reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "verification_cases_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'pending'::"text", 'in_review'::"text", 'approved'::"text", 'rejected'::"text", 'expired'::"text", 'revoked'::"text"]))),
    CONSTRAINT "verification_cases_subject_type_check" CHECK (("subject_type" = ANY (ARRAY['driver'::"text", 'provider'::"text", 'vehicle'::"text", 'local'::"text", 'traveler'::"text", 'service_staff'::"text"]))),
    CONSTRAINT "verification_cases_verification_level_check" CHECK (("verification_level" = ANY (ARRAY['basic'::"text", 'identity'::"text", 'enhanced'::"text"])))
);


ALTER TABLE "public"."verification_cases" OWNER TO "postgres";


COMMENT ON TABLE "public"."verification_cases" IS 'Private verification cases. Empty until a real review or provider exists. Not publicly readable.';



CREATE TABLE IF NOT EXISTS "public"."verification_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "actor" "text",
    "provider" "text",
    "external_ref" "text",
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider_event_id" "text"
);


ALTER TABLE "public"."verification_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."verification_events" IS 'Append-only verification audit trail.';



CREATE TABLE IF NOT EXISTS "public"."verification_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "evidence_type" "text" NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "provider" "text" DEFAULT 'human_review'::"text" NOT NULL,
    "external_ref" "text",
    "storage_ref" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "rejection_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "verification_evidence_evidence_type_check" CHECK (("evidence_type" = ANY (ARRAY['identity'::"text", 'selfie'::"text", 'liveness'::"text", 'license'::"text", 'insurance'::"text", 'vehicle_registration'::"text", 'business_registration'::"text", 'address'::"text", 'safety_check'::"text", 'background_check'::"text", 'provider_attestation'::"text"]))),
    CONSTRAINT "verification_evidence_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'accepted'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."verification_evidence" OWNER TO "postgres";


COMMENT ON TABLE "public"."verification_evidence" IS 'Opaque evidence references only. Do not store passport, national ID, or raw document images.';



COMMENT ON COLUMN "public"."verification_evidence"."storage_ref" IS 'Opaque private storage identifier. Never expose via public APIs.';



COMMENT ON COLUMN "public"."verification_evidence"."metadata" IS 'Workflow metadata only. For AI document verification store decision, confidence, checks and model metadata; never store identity numbers or raw document contents.';



ALTER TABLE ONLY "public"."activity_booking_pricing_ledger"
    ADD CONSTRAINT "activity_booking_pricing_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_telemetry_logs"
    ADD CONSTRAINT "admin_telemetry_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."ai_discovered_events"
    ADD CONSTRAINT "ai_discovered_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_event_itineraries"
    ADD CONSTRAINT "ai_event_itineraries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_sales_outreach"
    ADD CONSTRAINT "ai_sales_outreach_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_sales_prospects"
    ADD CONSTRAINT "ai_sales_prospects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_scans"
    ADD CONSTRAINT "ai_scans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_scout_locks"
    ADD CONSTRAINT "ai_scout_locks_pkey" PRIMARY KEY ("lock_name");



ALTER TABLE ONLY "public"."ai_scout_runs"
    ADD CONSTRAINT "ai_scout_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aurelian_feed_runs"
    ADD CONSTRAINT "aurelian_feed_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_status_events"
    ADD CONSTRAINT "booking_status_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_public_id_key" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."concierge_rate_limits"
    ADD CONSTRAINT "concierge_rate_limits_pkey" PRIMARY KEY ("bucket");



ALTER TABLE ONLY "public"."crm_activities"
    ADD CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_contacts"
    ADD CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_conversions"
    ADD CONSTRAINT "crm_conversions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_followups"
    ADD CONSTRAINT "crm_followups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discoveries"
    ADD CONSTRAINT "discoveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_assignments"
    ADD CONSTRAINT "driver_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_availability"
    ADD CONSTRAINT "driver_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_compliance_alerts"
    ADD CONSTRAINT "driver_compliance_alerts_driver_id_vehicle_id_document_type_key" UNIQUE ("driver_id", "vehicle_id", "document_type", "expires_on", "alert_type");



ALTER TABLE ONLY "public"."driver_compliance_alerts"
    ADD CONSTRAINT "driver_compliance_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_profiles"
    ADD CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_transfer_rates"
    ADD CONSTRAINT "driver_transfer_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_transfer_requests"
    ADD CONSTRAINT "driver_transfer_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."food_delivery_assignments"
    ADD CONSTRAINT "food_delivery_assignments_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."food_delivery_assignments"
    ADD CONSTRAINT "food_delivery_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_order_item_options"
    ADD CONSTRAINT "food_order_item_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_order_items"
    ADD CONSTRAINT "food_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_order_payment_idempotency"
    ADD CONSTRAINT "food_order_payment_idempotenc_customer_user_id_provider_ide_key" UNIQUE ("customer_user_id", "provider", "idempotency_key");



ALTER TABLE ONLY "public"."food_order_payment_idempotency"
    ADD CONSTRAINT "food_order_payment_idempotency_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_order_refunds"
    ADD CONSTRAINT "food_order_refunds_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."food_order_refunds"
    ADD CONSTRAINT "food_order_refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_orders"
    ADD CONSTRAINT "food_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_orders"
    ADD CONSTRAINT "food_orders_public_id_key" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."hotel_booking_pricing_ledger"
    ADD CONSTRAINT "hotel_booking_pricing_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hotel_checkout_intents"
    ADD CONSTRAINT "hotel_checkout_intents_customer_user_id_provider_intent_key_key" UNIQUE ("customer_user_id", "provider", "intent_key");



ALTER TABLE ONLY "public"."hotel_checkout_intents"
    ADD CONSTRAINT "hotel_checkout_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hotelbeds_content_sync_state"
    ADD CONSTRAINT "hotelbeds_content_sync_state_pkey" PRIMARY KEY ("sync_key");



ALTER TABLE ONLY "public"."hotelbeds_hotel_content"
    ADD CONSTRAINT "hotelbeds_hotel_content_pkey" PRIMARY KEY ("hotel_code");



ALTER TABLE ONLY "public"."integration_syncs"
    ADD CONSTRAINT "integration_syncs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_syncs"
    ADD CONSTRAINT "integration_syncs_provider_safariplug_event_id_key" UNIQUE ("provider", "safariplug_event_id");



ALTER TABLE ONLY "public"."inventory_kinds"
    ADD CONSTRAINT "inventory_kinds_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."journal_articles"
    ADD CONSTRAINT "journal_articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_articles"
    ADD CONSTRAINT "journal_articles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."local_availability"
    ADD CONSTRAINT "local_availability_local_id_available_on_start_time_end_tim_key" UNIQUE ("local_id", "available_on", "start_time", "end_time");



ALTER TABLE ONLY "public"."local_availability"
    ADD CONSTRAINT "local_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_profiles"
    ADD CONSTRAINT "local_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_profiles"
    ADD CONSTRAINT "local_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."local_requests"
    ADD CONSTRAINT "local_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_drafts"
    ADD CONSTRAINT "marketing_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offerings"
    ADD CONSTRAINT "offerings_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."offerings"
    ADD CONSTRAINT "offerings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_invitations"
    ADD CONSTRAINT "partner_invitations_invitation_token_key" UNIQUE ("invitation_token");



ALTER TABLE ONLY "public"."partner_invitations"
    ADD CONSTRAINT "partner_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_quotes"
    ADD CONSTRAINT "price_quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."push_notification_tokens"
    ADD CONSTRAINT "push_notification_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_notification_tokens"
    ADD CONSTRAINT "push_notification_tokens_user_id_expo_push_token_key" UNIQUE ("user_id", "expo_push_token");



ALTER TABLE ONLY "public"."restaurant_menu_categories"
    ADD CONSTRAINT "restaurant_menu_categories_business_id_name_key" UNIQUE ("business_id", "name");



ALTER TABLE ONLY "public"."restaurant_menu_categories"
    ADD CONSTRAINT "restaurant_menu_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_menu_item_option_values"
    ADD CONSTRAINT "restaurant_menu_item_option_values_option_id_name_key" UNIQUE ("option_id", "name");



ALTER TABLE ONLY "public"."restaurant_menu_item_option_values"
    ADD CONSTRAINT "restaurant_menu_item_option_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_menu_item_options"
    ADD CONSTRAINT "restaurant_menu_item_options_menu_item_id_name_key" UNIQUE ("menu_item_id", "name");



ALTER TABLE ONLY "public"."restaurant_menu_item_options"
    ADD CONSTRAINT "restaurant_menu_item_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_menu_items"
    ADD CONSTRAINT "restaurant_menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_settings"
    ADD CONSTRAINT "restaurant_settings_business_id_key" UNIQUE ("business_id");



ALTER TABLE ONLY "public"."restaurant_settings"
    ADD CONSTRAINT "restaurant_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."safari_partners"
    ADD CONSTRAINT "safari_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_traveler_id_event_id_key" UNIQUE ("traveler_id", "event_id");



ALTER TABLE ONLY "public"."scout_runs"
    ADD CONSTRAINT "scout_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_appointment_notifications"
    ADD CONSTRAINT "service_appointment_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_appointment_status_events"
    ADD CONSTRAINT "service_appointment_status_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_appointments"
    ADD CONSTRAINT "service_appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_appointments"
    ADD CONSTRAINT "service_appointments_public_id_key" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."service_appointments"
    ADD CONSTRAINT "service_appointments_staff_no_overlap" EXCLUDE USING "gist" ("staff_id" WITH =, "tstzrange"("starts_at", "ends_at", '[)'::"text") WITH &&) WHERE (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'checked_in'::"text", 'in_progress'::"text"])));



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."service_offerings"
    ADD CONSTRAINT "service_offerings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_offerings"
    ADD CONSTRAINT "service_offerings_service_profile_id_slug_key" UNIQUE ("service_profile_id", "slug");



ALTER TABLE ONLY "public"."service_payment_events"
    ADD CONSTRAINT "service_payment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_payment_events"
    ADD CONSTRAINT "service_payment_events_provider_event_id_key" UNIQUE ("provider", "event_id");



ALTER TABLE ONLY "public"."service_payment_idempotency"
    ADD CONSTRAINT "service_payment_idempotency_customer_user_id_provider_idemp_key" UNIQUE ("customer_user_id", "provider", "idempotency_key");



ALTER TABLE ONLY "public"."service_payment_idempotency"
    ADD CONSTRAINT "service_payment_idempotency_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_payment_ledger"
    ADD CONSTRAINT "service_payment_ledger_appointment_id_key" UNIQUE ("appointment_id");



ALTER TABLE ONLY "public"."service_payment_ledger"
    ADD CONSTRAINT "service_payment_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_payment_webhook_events"
    ADD CONSTRAINT "service_payment_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_payment_webhook_events"
    ADD CONSTRAINT "service_payment_webhook_events_provider_event_id_key" UNIQUE ("provider", "event_id");



ALTER TABLE ONLY "public"."service_profiles"
    ADD CONSTRAINT "service_profiles_business_id_key" UNIQUE ("business_id");



ALTER TABLE ONLY "public"."service_profiles"
    ADD CONSTRAINT "service_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_provider_payout_accounts"
    ADD CONSTRAINT "service_provider_payout_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_provider_payout_accounts"
    ADD CONSTRAINT "service_provider_payout_accounts_provider_user_id_provider_key" UNIQUE ("provider_user_id", "provider");



ALTER TABLE ONLY "public"."service_provider_payouts"
    ADD CONSTRAINT "service_provider_payouts_appointment_id_key" UNIQUE ("appointment_id");



ALTER TABLE ONLY "public"."service_provider_payouts"
    ADD CONSTRAINT "service_provider_payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_staff_availability"
    ADD CONSTRAINT "service_staff_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_staff_availability"
    ADD CONSTRAINT "service_staff_availability_staff_id_day_of_week_start_time__key" UNIQUE ("staff_id", "day_of_week", "start_time", "end_time");



ALTER TABLE ONLY "public"."service_staff_blockouts"
    ADD CONSTRAINT "service_staff_blockouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_staff_claim_tokens"
    ADD CONSTRAINT "service_staff_claim_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_staff_claim_tokens"
    ADD CONSTRAINT "service_staff_claim_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."service_staff_offerings"
    ADD CONSTRAINT "service_staff_offerings_pkey" PRIMARY KEY ("staff_id", "offering_id");



ALTER TABLE ONLY "public"."service_staff"
    ADD CONSTRAINT "service_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sources"
    ADD CONSTRAINT "sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_accounts"
    ADD CONSTRAINT "supplier_accounts_business_id_key" UNIQUE ("business_id");



ALTER TABLE ONLY "public"."supplier_accounts"
    ADD CONSTRAINT "supplier_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_accounts"
    ADD CONSTRAINT "supplier_accounts_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."supplier_followup_prep_runs"
    ADD CONSTRAINT "supplier_followup_prep_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_onboarding_followup_drafts"
    ADD CONSTRAINT "supplier_onboarding_followup_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_onboarding_followups"
    ADD CONSTRAINT "supplier_onboarding_followups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_scout_jobs"
    ADD CONSTRAINT "supplier_scout_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transfer_booking_pricing_ledger"
    ADD CONSTRAINT "transfer_booking_pricing_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_refund_review_events"
    ADD CONSTRAINT "travel_refund_review_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_refund_reviews"
    ADD CONSTRAINT "travel_refund_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_refund_reviews"
    ADD CONSTRAINT "travel_refund_reviews_product_ledger_id_key" UNIQUE ("product", "ledger_id");



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_package_checkout_attempts"
    ADD CONSTRAINT "trip_package_checkout_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_package_payment_intents"
    ADD CONSTRAINT "trip_package_payment_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_package_payment_intents"
    ADD CONSTRAINT "trip_package_payment_intents_traveler_id_idempotency_key_key" UNIQUE ("traveler_id", "idempotency_key");



ALTER TABLE ONLY "public"."trip_package_quotes"
    ADD CONSTRAINT "trip_package_quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verification_cases"
    ADD CONSTRAINT "verification_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verification_events"
    ADD CONSTRAINT "verification_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verification_evidence"
    ADD CONSTRAINT "verification_evidence_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "activity_booking_pricing_ledger_checkout_intent_idx" ON "public"."activity_booking_pricing_ledger" USING "btree" ("customer_user_id", "provider", "checkout_intent_key") WHERE ("checkout_intent_key" IS NOT NULL);



CREATE INDEX "activity_booking_pricing_ledger_customer_idx" ON "public"."activity_booking_pricing_ledger" USING "btree" ("customer_user_id", "created_at" DESC);



CREATE UNIQUE INDEX "activity_booking_pricing_ledger_payment_ref_idx" ON "public"."activity_booking_pricing_ledger" USING "btree" ("payment_provider", "payment_reference") WHERE ("payment_reference" IS NOT NULL);



CREATE UNIQUE INDEX "activity_booking_pricing_ledger_prepared_idx" ON "public"."activity_booking_pricing_ledger" USING "btree" ("prepared_booking_id");



CREATE INDEX "activity_booking_pricing_ledger_provider_idx" ON "public"."activity_booking_pricing_ledger" USING "btree" ("provider", "booking_status", "supplier_settlement_status");



CREATE INDEX "ai_discovered_events_category_idx" ON "public"."ai_discovered_events" USING "btree" ("category");



CREATE INDEX "ai_discovered_events_city_idx" ON "public"."ai_discovered_events" USING "btree" ("city");



CREATE UNIQUE INDEX "ai_discovered_events_source_start_unique_idx" ON "public"."ai_discovered_events" USING "btree" ("lower"("btrim"("source_url")), "start_at") WHERE (("source_url" IS NOT NULL) AND ("btrim"("source_url") <> ''::"text") AND ("start_at" IS NOT NULL));



CREATE INDEX "ai_discovered_events_source_url_idx" ON "public"."ai_discovered_events" USING "btree" ("source_url") WHERE ("source_url" IS NOT NULL);



CREATE INDEX "ai_discovered_events_start_at_idx" ON "public"."ai_discovered_events" USING "btree" ("start_at");



CREATE INDEX "ai_discovered_events_status_idx" ON "public"."ai_discovered_events" USING "btree" ("status");



CREATE UNIQUE INDEX "ai_discovered_events_title_city_start_unique_idx" ON "public"."ai_discovered_events" USING "btree" ("lower"("btrim"("title")), "lower"("btrim"(COALESCE("city", ''::"text"))), "start_at") WHERE ("start_at" IS NOT NULL);



CREATE INDEX "ai_event_itineraries_event_id_idx" ON "public"."ai_event_itineraries" USING "btree" ("event_id");



CREATE INDEX "ai_sales_outreach_prospect_id_idx" ON "public"."ai_sales_outreach" USING "btree" ("prospect_id");



CREATE UNIQUE INDEX "ai_scout_runs_one_active_mission_idx" ON "public"."ai_scout_runs" USING "btree" ("lower"("btrim"("location")), "category") WHERE (("status" = ANY (ARRAY['queued'::"text", 'running'::"text"])) AND ("queued_at" IS NOT NULL));



CREATE INDEX "ai_scout_runs_provider_failure_idx" ON "public"."ai_scout_runs" USING "btree" ("status", "provider_failure_count") WHERE ("queued_at" IS NOT NULL);



CREATE INDEX "ai_scout_runs_queue_idx" ON "public"."ai_scout_runs" USING "btree" ("status", "queued_at", "created_at");



CREATE INDEX "ai_scout_runs_queue_ready_idx" ON "public"."ai_scout_runs" USING "btree" ("status", "queued_at", "created_at") WHERE ("status" = 'queued'::"text");



CREATE INDEX "ai_scout_runs_running_lease_idx" ON "public"."ai_scout_runs" USING "btree" ("poll_lease_until", "claimed_at", "created_at") WHERE (("status" = 'running'::"text") AND ("queued_at" IS NOT NULL) AND ("provider_response_id" IS NOT NULL));



CREATE INDEX "aurelian_feed_runs_provider_requested_idx" ON "public"."aurelian_feed_runs" USING "btree" ("provider", "requested_at" DESC);



CREATE INDEX "aurelian_feed_runs_requested_at_idx" ON "public"."aurelian_feed_runs" USING "btree" ("requested_at" DESC);



CREATE INDEX "booking_status_events_booking_idx" ON "public"."booking_status_events" USING "btree" ("booking_id", "created_at");



CREATE INDEX "bookings_event_idx" ON "public"."bookings" USING "btree" ("event_id");



CREATE INDEX "bookings_offering_id_idx" ON "public"."bookings" USING "btree" ("offering_id");



CREATE INDEX "bookings_provider_id_idx" ON "public"."bookings" USING "btree" ("provider_id");



CREATE INDEX "bookings_status_idx" ON "public"."bookings" USING "btree" ("status");



CREATE INDEX "bookings_traveler_idx" ON "public"."bookings" USING "btree" ("traveler_id", "created_at" DESC);



CREATE INDEX "bookings_trip_id_idx" ON "public"."bookings" USING "btree" ("trip_id");



CREATE INDEX "businesses_owner_id_idx" ON "public"."businesses" USING "btree" ("owner_id");



CREATE INDEX "crm_activities_contact_id_idx" ON "public"."crm_activities" USING "btree" ("contact_id") WHERE ("contact_id" IS NOT NULL);



CREATE INDEX "crm_activities_partner_time_idx" ON "public"."crm_activities" USING "btree" ("partner_id", "occurred_at" DESC);



CREATE INDEX "crm_activities_prospect_time_idx" ON "public"."crm_activities" USING "btree" ("prospect_id", "occurred_at" DESC);



CREATE UNIQUE INDEX "crm_contacts_one_primary_per_partner_idx" ON "public"."crm_contacts" USING "btree" ("partner_id") WHERE (("is_primary" = true) AND ("partner_id" IS NOT NULL));



CREATE UNIQUE INDEX "crm_contacts_one_primary_per_prospect_idx" ON "public"."crm_contacts" USING "btree" ("prospect_id") WHERE (("is_primary" = true) AND ("prospect_id" IS NOT NULL));



CREATE INDEX "crm_contacts_partner_idx" ON "public"."crm_contacts" USING "btree" ("partner_id");



CREATE INDEX "crm_contacts_primary_idx" ON "public"."crm_contacts" USING "btree" ("is_primary") WHERE ("is_primary" = true);



CREATE INDEX "crm_contacts_prospect_idx" ON "public"."crm_contacts" USING "btree" ("prospect_id");



CREATE INDEX "crm_conversions_outcome_idx" ON "public"."crm_conversions" USING "btree" ("outcome", "occurred_at" DESC);



CREATE INDEX "crm_conversions_partner_time_idx" ON "public"."crm_conversions" USING "btree" ("partner_id", "occurred_at" DESC);



CREATE INDEX "crm_conversions_prospect_time_idx" ON "public"."crm_conversions" USING "btree" ("prospect_id", "occurred_at" DESC);



CREATE INDEX "crm_followups_contact_id_idx" ON "public"."crm_followups" USING "btree" ("contact_id") WHERE ("contact_id" IS NOT NULL);



CREATE INDEX "crm_followups_partner_due_idx" ON "public"."crm_followups" USING "btree" ("partner_id", "status", "due_at");



CREATE INDEX "crm_followups_prospect_due_idx" ON "public"."crm_followups" USING "btree" ("prospect_id", "status", "due_at");



CREATE INDEX "discoveries_source_id_idx" ON "public"."discoveries" USING "btree" ("source_id");



CREATE UNIQUE INDEX "driver_assignments_active_booking_uidx" ON "public"."driver_assignments" USING "btree" ("booking_id") WHERE ("status" = ANY (ARRAY['assigned'::"text", 'accepted'::"text"]));



CREATE INDEX "driver_assignments_booking_idx" ON "public"."driver_assignments" USING "btree" ("booking_id", "created_at" DESC);



CREATE INDEX "driver_assignments_driver_id_idx" ON "public"."driver_assignments" USING "btree" ("driver_id");



CREATE INDEX "driver_assignments_vehicle_id_idx" ON "public"."driver_assignments" USING "btree" ("vehicle_id");



CREATE INDEX "driver_availability_driver_date_idx" ON "public"."driver_availability" USING "btree" ("driver_id", "available_on");



CREATE INDEX "driver_compliance_alerts_driver_idx" ON "public"."driver_compliance_alerts" USING "btree" ("driver_id", "status", "expires_on");



CREATE INDEX "driver_compliance_alerts_open_idx" ON "public"."driver_compliance_alerts" USING "btree" ("status", "expires_on");



CREATE INDEX "driver_compliance_alerts_vehicle_id_idx" ON "public"."driver_compliance_alerts" USING "btree" ("vehicle_id");



CREATE INDEX "driver_profiles_license_expiry_idx" ON "public"."driver_profiles" USING "btree" ("driving_license_expires_on") WHERE ("driving_license_expires_on" IS NOT NULL);



CREATE INDEX "driver_profiles_provider_idx" ON "public"."driver_profiles" USING "btree" ("provider_id");



CREATE INDEX "driver_profiles_service_city_id_idx" ON "public"."driver_profiles" USING "btree" ("service_city_id");



CREATE UNIQUE INDEX "driver_profiles_source_external_id_idx" ON "public"."driver_profiles" USING "btree" ("source", "external_id") WHERE ("external_id" IS NOT NULL);



CREATE INDEX "driver_profiles_status_idx" ON "public"."driver_profiles" USING "btree" ("service_status", "verification_state");



CREATE UNIQUE INDEX "driver_profiles_user_id_uidx" ON "public"."driver_profiles" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "driver_transfer_rates_driver_idx" ON "public"."driver_transfer_rates" USING "btree" ("driver_id", "status");



CREATE INDEX "driver_transfer_requests_driver_idx" ON "public"."driver_transfer_requests" USING "btree" ("driver_id", "status", "requested_at");



CREATE INDEX "driver_transfer_requests_transfer_rate_id_idx" ON "public"."driver_transfer_requests" USING "btree" ("transfer_rate_id") WHERE ("transfer_rate_id" IS NOT NULL);



CREATE INDEX "driver_transfer_requests_traveler_idx" ON "public"."driver_transfer_requests" USING "btree" ("traveler_id", "created_at" DESC);



CREATE INDEX "driver_transfer_requests_trip_id_idx" ON "public"."driver_transfer_requests" USING "btree" ("trip_id") WHERE ("trip_id" IS NOT NULL);



CREATE INDEX "events_category_idx" ON "public"."events" USING "btree" ("category");



CREATE INDEX "events_city_id_idx" ON "public"."events" USING "btree" ("city_id");



CREATE INDEX "events_featured_idx" ON "public"."events" USING "btree" ("featured");



CREATE INDEX "events_is_featured_idx" ON "public"."events" USING "btree" ("is_featured") WHERE ("is_featured" = true);



CREATE INDEX "events_organizer_id_idx" ON "public"."events" USING "btree" ("organizer_id");



CREATE INDEX "events_source_url_idx" ON "public"."events" USING "btree" ("source_url") WHERE ("source_url" IS NOT NULL);



CREATE INDEX "events_start_at_idx" ON "public"."events" USING "btree" ("start_at");



CREATE INDEX "events_status_idx" ON "public"."events" USING "btree" ("status");



CREATE INDEX "events_submitted_by_idx" ON "public"."events" USING "btree" ("submitted_by");



CREATE UNIQUE INDEX "food_delivery_assignments_active_driver_key" ON "public"."food_delivery_assignments" USING "btree" ("driver_id") WHERE ("status" = ANY (ARRAY['assigned'::"text", 'accepted'::"text", 'arrived_at_restaurant'::"text", 'picked_up'::"text", 'on_the_way'::"text"]));



CREATE INDEX "food_delivery_assignments_active_order_idx" ON "public"."food_delivery_assignments" USING "btree" ("order_id", "status") WHERE ("status" = ANY (ARRAY['assigned'::"text", 'accepted'::"text", 'arrived_at_restaurant'::"text", 'picked_up'::"text", 'on_the_way'::"text"]));



CREATE INDEX "food_delivery_assignments_assigned_by_idx" ON "public"."food_delivery_assignments" USING "btree" ("assigned_by");



CREATE INDEX "food_delivery_assignments_driver_status_idx" ON "public"."food_delivery_assignments" USING "btree" ("driver_id", "status", "created_at" DESC);



CREATE INDEX "food_delivery_assignments_vehicle_id_idx" ON "public"."food_delivery_assignments" USING "btree" ("vehicle_id");



CREATE INDEX "food_order_item_options_order_item_id_idx" ON "public"."food_order_item_options" USING "btree" ("order_item_id");



CREATE INDEX "food_order_items_menu_item_id_idx" ON "public"."food_order_items" USING "btree" ("menu_item_id");



CREATE INDEX "food_order_payment_idempotency_order_id_idx" ON "public"."food_order_payment_idempotency" USING "btree" ("order_id");



CREATE INDEX "food_order_payment_idempotency_processing_idx" ON "public"."food_order_payment_idempotency" USING "btree" ("processing_until") WHERE ("payment_intent_id" IS NULL);



CREATE UNIQUE INDEX "food_order_payment_mpesa_provider_reference_unique" ON "public"."food_order_payment_idempotency" USING "btree" ("provider", "provider_reference") WHERE (("provider" = 'mpesa'::"text") AND ("provider_reference" IS NOT NULL));



CREATE UNIQUE INDEX "food_order_payment_one_active_attempt" ON "public"."food_order_payment_idempotency" USING "btree" ("order_id", "provider") WHERE ("attempt_active" IS TRUE);



CREATE INDEX "food_order_payment_provider_ref_idx" ON "public"."food_order_payment_idempotency" USING "btree" ("provider", "provider_reference");



CREATE UNIQUE INDEX "food_order_refunds_mpesa_provider_reference_unique" ON "public"."food_order_refunds" USING "btree" ("provider", "provider_reference") WHERE (("provider" = 'mpesa'::"text") AND ("provider_reference" IS NOT NULL));



CREATE UNIQUE INDEX "food_order_refunds_mpesa_refund_reference_unique" ON "public"."food_order_refunds" USING "btree" ("provider", "refund_reference") WHERE (("provider" = 'mpesa'::"text") AND ("refund_reference" IS NOT NULL));



CREATE UNIQUE INDEX "food_order_refunds_one_active" ON "public"."food_order_refunds" USING "btree" ("order_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "food_order_refunds_order_idx" ON "public"."food_order_refunds" USING "btree" ("order_id", "created_at" DESC);



CREATE INDEX "food_order_refunds_provider_reference_idx" ON "public"."food_order_refunds" USING "btree" ("provider_reference") WHERE ("provider_reference" IS NOT NULL);



CREATE INDEX "food_orders_accepted_by_idx" ON "public"."food_orders" USING "btree" ("accepted_by");



CREATE INDEX "food_orders_business_status_idx" ON "public"."food_orders" USING "btree" ("business_id", "status", "created_at" DESC);



CREATE UNIQUE INDEX "food_orders_customer_rating_once_idx" ON "public"."food_orders" USING "btree" ("id") WHERE ("customer_rating" IS NOT NULL);



CREATE INDEX "food_orders_customer_status_idx" ON "public"."food_orders" USING "btree" ("customer_user_id", "status", "created_at" DESC);



CREATE INDEX "food_orders_trip_id_idx" ON "public"."food_orders" USING "btree" ("trip_id");



CREATE UNIQUE INDEX "hotel_booking_pricing_ledger_checkout_intent_idx" ON "public"."hotel_booking_pricing_ledger" USING "btree" ("customer_user_id", "provider", "checkout_intent_key") WHERE ("checkout_intent_key" IS NOT NULL);



CREATE INDEX "hotel_booking_pricing_ledger_customer_idx" ON "public"."hotel_booking_pricing_ledger" USING "btree" ("customer_user_id", "created_at" DESC);



CREATE UNIQUE INDEX "hotel_booking_pricing_ledger_payment_provider_reference_idx" ON "public"."hotel_booking_pricing_ledger" USING "btree" ("payment_provider", "payment_reference") WHERE (("payment_provider" IS NOT NULL) AND ("payment_reference" IS NOT NULL));



CREATE INDEX "hotel_booking_pricing_ledger_provider_booking_idx" ON "public"."hotel_booking_pricing_ledger" USING "btree" ("provider", "provider_booking_reference");



CREATE INDEX "hotel_checkout_intents_customer_idx" ON "public"."hotel_checkout_intents" USING "btree" ("customer_user_id", "created_at" DESC);



CREATE INDEX "hotel_checkout_intents_ledger_id_idx" ON "public"."hotel_checkout_intents" USING "btree" ("ledger_id") WHERE ("ledger_id" IS NOT NULL);



CREATE INDEX "hotelbeds_hotel_content_destination_idx" ON "public"."hotelbeds_hotel_content" USING "btree" ("destination_code");



CREATE INDEX "hotelbeds_hotel_content_name_idx" ON "public"."hotelbeds_hotel_content" USING "btree" ("lower"("name"));



CREATE INDEX "idx_businesses_city" ON "public"."businesses" USING "btree" ("city_id");



CREATE INDEX "idx_discoveries_status" ON "public"."discoveries" USING "btree" ("status");



CREATE INDEX "idx_food_delivery_assignments_driver" ON "public"."food_delivery_assignments" USING "btree" ("driver_id", "status");



CREATE INDEX "idx_food_order_items_order" ON "public"."food_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_food_orders_customer" ON "public"."food_orders" USING "btree" ("customer_user_id", "created_at" DESC);



CREATE INDEX "idx_listings_city" ON "public"."listings" USING "btree" ("city_id");



CREATE INDEX "idx_listings_start_date" ON "public"."listings" USING "btree" ("start_date");



CREATE INDEX "idx_listings_status" ON "public"."listings" USING "btree" ("status");



CREATE INDEX "idx_listings_type" ON "public"."listings" USING "btree" ("listing_type");



CREATE INDEX "idx_promotions_city" ON "public"."promotions" USING "btree" ("city_id");



CREATE INDEX "idx_promotions_dates" ON "public"."promotions" USING "btree" ("start_at", "end_at");



CREATE INDEX "idx_promotions_status" ON "public"."promotions" USING "btree" ("status");



CREATE INDEX "idx_restaurant_menu_categories_business" ON "public"."restaurant_menu_categories" USING "btree" ("business_id", "active", "sort_order");



CREATE INDEX "idx_restaurant_menu_items_business" ON "public"."restaurant_menu_items" USING "btree" ("business_id", "active", "available", "sort_order");



CREATE UNIQUE INDEX "idx_unique_event_signature" ON "public"."ai_discovered_events" USING "btree" ("lower"("title"), "start_at");



CREATE INDEX "integration_syncs_event_idx" ON "public"."integration_syncs" USING "btree" ("safariplug_event_id");



CREATE INDEX "integration_syncs_provider_status_idx" ON "public"."integration_syncs" USING "btree" ("provider", "sync_status");



CREATE INDEX "journal_articles_city_idx" ON "public"."journal_articles" USING "btree" ("city");



CREATE INDEX "journal_articles_event_id_idx" ON "public"."journal_articles" USING "btree" ("event_id");



CREATE INDEX "journal_articles_published_at_idx" ON "public"."journal_articles" USING "btree" ("published_at" DESC);



CREATE INDEX "journal_articles_source_event_id_idx" ON "public"."journal_articles" USING "btree" ("source_event_id");



CREATE INDEX "journal_articles_status_idx" ON "public"."journal_articles" USING "btree" ("status");



CREATE INDEX "listings_business_id_idx" ON "public"."listings" USING "btree" ("business_id");



CREATE INDEX "listings_category_id_idx" ON "public"."listings" USING "btree" ("category_id");



CREATE INDEX "local_availability_lookup_idx" ON "public"."local_availability" USING "btree" ("local_id", "available_on", "status");



CREATE INDEX "local_profiles_public_idx" ON "public"."local_profiles" USING "btree" ("service_status", "verification_state", "city");



CREATE INDEX "local_requests_local_idx" ON "public"."local_requests" USING "btree" ("local_id", "created_at" DESC);



CREATE INDEX "local_requests_traveler_idx" ON "public"."local_requests" USING "btree" ("traveler_id", "created_at" DESC);



CREATE INDEX "local_requests_trip_idx" ON "public"."local_requests" USING "btree" ("trip_id") WHERE ("trip_id" IS NOT NULL);



CREATE UNIQUE INDEX "marketing_drafts_event_platform_active_unique_idx" ON "public"."marketing_drafts" USING "btree" ("event_id", "platform") WHERE (("event_id" IS NOT NULL) AND ("status" <> 'rejected'::"text"));



CREATE INDEX "marketing_drafts_video_job_id_idx" ON "public"."marketing_drafts" USING "btree" ("video_job_id");



CREATE INDEX "offerings_city_idx" ON "public"."offerings" USING "btree" ("city_id");



CREATE INDEX "offerings_kind_idx" ON "public"."offerings" USING "btree" ("kind");



CREATE INDEX "offerings_provider_idx" ON "public"."offerings" USING "btree" ("provider_id");



CREATE INDEX "offerings_status_kind_idx" ON "public"."offerings" USING "btree" ("status", "kind");



CREATE INDEX "partner_invitations_contact_id_idx" ON "public"."partner_invitations" USING "btree" ("contact_id") WHERE ("contact_id" IS NOT NULL);



CREATE INDEX "partner_invitations_created_by_idx" ON "public"."partner_invitations" USING "btree" ("created_by") WHERE ("created_by" IS NOT NULL);



CREATE INDEX "partner_invitations_onboarded_user_id_idx" ON "public"."partner_invitations" USING "btree" ("onboarded_user_id") WHERE ("onboarded_user_id" IS NOT NULL);



CREATE INDEX "partner_invitations_partner_id_idx" ON "public"."partner_invitations" USING "btree" ("partner_id") WHERE ("partner_id" IS NOT NULL);



CREATE INDEX "partner_invitations_prospect_id_idx" ON "public"."partner_invitations" USING "btree" ("prospect_id") WHERE ("prospect_id" IS NOT NULL);



CREATE INDEX "partner_invitations_status_idx" ON "public"."partner_invitations" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "partner_invitations_token_idx" ON "public"."partner_invitations" USING "btree" ("invitation_token");



CREATE INDEX "price_quotes_booking_id_idx" ON "public"."price_quotes" USING "btree" ("booking_id");



CREATE INDEX "price_quotes_offering_id_idx" ON "public"."price_quotes" USING "btree" ("offering_id");



CREATE INDEX "promotions_business_id_idx" ON "public"."promotions" USING "btree" ("business_id");



CREATE INDEX "promotions_category_id_idx" ON "public"."promotions" USING "btree" ("category_id");



CREATE INDEX "providers_city_idx" ON "public"."providers" USING "btree" ("city_id");



CREATE UNIQUE INDEX "providers_source_external_id_idx" ON "public"."providers" USING "btree" ("source", "external_id") WHERE ("external_id" IS NOT NULL);



CREATE INDEX "providers_status_idx" ON "public"."providers" USING "btree" ("status");



CREATE INDEX "providers_type_idx" ON "public"."providers" USING "btree" ("provider_type");



CREATE INDEX "push_notification_tokens_user_idx" ON "public"."push_notification_tokens" USING "btree" ("user_id", "enabled");



CREATE INDEX "restaurant_menu_items_category_id_idx" ON "public"."restaurant_menu_items" USING "btree" ("category_id");



CREATE INDEX "saved_events_event_id_idx" ON "public"."saved_events" USING "btree" ("event_id");



CREATE INDEX "saved_events_traveler_id_idx" ON "public"."saved_events" USING "btree" ("traveler_id");



CREATE INDEX "service_appointment_notifications_appointment_created_idx" ON "public"."service_appointment_notifications" USING "btree" ("appointment_id", "created_at" DESC);



CREATE INDEX "service_appointment_notifications_user_created_idx" ON "public"."service_appointment_notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "service_appointment_status_events_actor_user_id_idx" ON "public"."service_appointment_status_events" USING "btree" ("actor_user_id");



CREATE INDEX "service_appointment_status_events_idx" ON "public"."service_appointment_status_events" USING "btree" ("appointment_id", "created_at");



CREATE INDEX "service_appointments_customer_idx" ON "public"."service_appointments" USING "btree" ("customer_user_id", "starts_at" DESC);



CREATE INDEX "service_appointments_offering_id_idx" ON "public"."service_appointments" USING "btree" ("offering_id");



CREATE INDEX "service_appointments_payment_status_idx" ON "public"."service_appointments" USING "btree" ("payment_status", "created_at" DESC);



CREATE INDEX "service_appointments_profile_time_idx" ON "public"."service_appointments" USING "btree" ("service_profile_id", "starts_at", "ends_at");



CREATE INDEX "service_appointments_staff_time_idx" ON "public"."service_appointments" USING "btree" ("staff_id", "starts_at", "ends_at");



CREATE INDEX "service_appointments_trip_id_idx" ON "public"."service_appointments" USING "btree" ("trip_id");



CREATE INDEX "service_offerings_category_id_idx" ON "public"."service_offerings" USING "btree" ("category_id");



CREATE INDEX "service_offerings_profile_status_idx" ON "public"."service_offerings" USING "btree" ("service_profile_id", "status");



CREATE INDEX "service_payment_events_appointment_idx" ON "public"."service_payment_events" USING "btree" ("appointment_id", "created_at" DESC);



CREATE INDEX "service_payment_events_status_idx" ON "public"."service_payment_events" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "service_payment_idempotency_active_lookup_idx" ON "public"."service_payment_idempotency" USING "btree" ("appointment_id", "customer_user_id", "provider") WHERE ("attempt_active" = true);



CREATE INDEX "service_payment_idempotency_appointment_idx" ON "public"."service_payment_idempotency" USING "btree" ("appointment_id", "created_at" DESC);



CREATE UNIQUE INDEX "service_payment_idempotency_one_active_attempt_idx" ON "public"."service_payment_idempotency" USING "btree" ("appointment_id", "provider") WHERE ("attempt_active" = true);



CREATE INDEX "service_payment_idempotency_processing_idx" ON "public"."service_payment_idempotency" USING "btree" ("processing_until") WHERE ("payment_intent_id" IS NULL);



CREATE INDEX "service_payment_idempotency_submission_state_idx" ON "public"."service_payment_idempotency" USING "btree" ("provider_submission_state") WHERE ("payment_intent_id" IS NULL);



CREATE INDEX "service_payment_ledger_reference_idx" ON "public"."service_payment_ledger" USING "btree" ("payment_reference");



CREATE INDEX "service_payment_ledger_status_idx" ON "public"."service_payment_ledger" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "service_payment_webhook_events_reference_idx" ON "public"."service_payment_webhook_events" USING "btree" ("provider_reference");



CREATE INDEX "service_payment_webhook_events_status_idx" ON "public"."service_payment_webhook_events" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "service_profiles_category_id_idx" ON "public"."service_profiles" USING "btree" ("category_id");



CREATE INDEX "service_profiles_notification_idx" ON "public"."service_profiles" USING "btree" ("notification_email", "notification_whatsapp");



CREATE INDEX "service_profiles_provider_terms_accepted_by_idx" ON "public"."service_profiles" USING "btree" ("provider_terms_accepted_by");



CREATE INDEX "service_profiles_provider_terms_idx" ON "public"."service_profiles" USING "btree" ("provider_terms_version", "provider_terms_accepted_at");



CREATE INDEX "service_profiles_status_idx" ON "public"."service_profiles" USING "btree" ("status", "booking_status");



CREATE INDEX "service_provider_payout_accounts_provider_status_idx" ON "public"."service_provider_payout_accounts" USING "btree" ("provider_user_id", "status");



CREATE INDEX "service_provider_payout_accounts_verified_by_idx" ON "public"."service_provider_payout_accounts" USING "btree" ("verified_by");



CREATE INDEX "service_provider_payouts_approval_idx" ON "public"."service_provider_payouts" USING "btree" ("status", "eligible_at", "updated_at" DESC);



CREATE INDEX "service_provider_payouts_approval_user_id_idx" ON "public"."service_provider_payouts" USING "btree" ("approval_user_id");



CREATE INDEX "service_provider_payouts_approved_by_idx" ON "public"."service_provider_payouts" USING "btree" ("approved_by");



CREATE UNIQUE INDEX "service_provider_payouts_conversation_id_uidx" ON "public"."service_provider_payouts" USING "btree" ("conversation_id") WHERE ("conversation_id" IS NOT NULL);



CREATE UNIQUE INDEX "service_provider_payouts_mpesa_conversation_uidx" ON "public"."service_provider_payouts" USING "btree" ("mpesa_conversation_id") WHERE ("mpesa_conversation_id" IS NOT NULL);



CREATE INDEX "service_provider_payouts_mpesa_transaction_idx" ON "public"."service_provider_payouts" USING "btree" ("mpesa_transaction_id") WHERE ("mpesa_transaction_id" IS NOT NULL);



CREATE UNIQUE INDEX "service_provider_payouts_originator_conversation_uidx" ON "public"."service_provider_payouts" USING "btree" ("originator_conversation_id") WHERE ("originator_conversation_id" IS NOT NULL);



CREATE INDEX "service_provider_payouts_payout_phone_verified_by_idx" ON "public"."service_provider_payouts" USING "btree" ("payout_phone_verified_by");



CREATE INDEX "service_provider_payouts_provider_idx" ON "public"."service_provider_payouts" USING "btree" ("provider_user_id", "status", "created_at" DESC);



CREATE INDEX "service_provider_payouts_reference_idx" ON "public"."service_provider_payouts" USING "btree" ("payout_reference");



CREATE INDEX "service_provider_payouts_review_idx" ON "public"."service_provider_payouts" USING "btree" ("status", "eligible_at") WHERE ("status" = ANY (ARRAY['eligible'::"text", 'approved'::"text", 'held'::"text"]));



CREATE INDEX "service_provider_payouts_service_profile_id_idx" ON "public"."service_provider_payouts" USING "btree" ("service_profile_id");



CREATE INDEX "service_provider_payouts_status_idx" ON "public"."service_provider_payouts" USING "btree" ("status", "eligible_at");



CREATE UNIQUE INDEX "service_provider_payouts_transaction_receipt_uidx" ON "public"."service_provider_payouts" USING "btree" ("transaction_receipt") WHERE ("transaction_receipt" IS NOT NULL);



CREATE INDEX "service_staff_availability_staff_day_idx" ON "public"."service_staff_availability" USING "btree" ("staff_id", "day_of_week", "is_active");



CREATE INDEX "service_staff_blockouts_staff_time_idx" ON "public"."service_staff_blockouts" USING "btree" ("staff_id", "starts_at", "ends_at");



CREATE INDEX "service_staff_claim_tokens_created_by_idx" ON "public"."service_staff_claim_tokens" USING "btree" ("created_by");



CREATE INDEX "service_staff_claim_tokens_staff_idx" ON "public"."service_staff_claim_tokens" USING "btree" ("staff_id", "created_at" DESC);



CREATE INDEX "service_staff_offerings_offering_id_idx" ON "public"."service_staff_offerings" USING "btree" ("offering_id");



CREATE INDEX "service_staff_profile_status_idx" ON "public"."service_staff" USING "btree" ("service_profile_id", "status");



CREATE INDEX "service_staff_user_id_idx" ON "public"."service_staff" USING "btree" ("user_id");



CREATE UNIQUE INDEX "service_staff_user_unique_idx" ON "public"."service_staff" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "sources_city_id_idx" ON "public"."sources" USING "btree" ("city_id");



CREATE UNIQUE INDEX "supplier_accounts_partner_id_unique" ON "public"."supplier_accounts" USING "btree" ("partner_id") WHERE ("partner_id" IS NOT NULL);



CREATE UNIQUE INDEX "supplier_accounts_prospect_id_unique" ON "public"."supplier_accounts" USING "btree" ("prospect_id") WHERE ("prospect_id" IS NOT NULL);



CREATE INDEX "supplier_accounts_status_idx" ON "public"."supplier_accounts" USING "btree" ("onboarding_status", "invitation_status");



CREATE INDEX "supplier_followup_prep_runs_completed_idx" ON "public"."supplier_followup_prep_runs" USING "btree" ("completed_at" DESC);



CREATE UNIQUE INDEX "supplier_onboarding_followup_drafts_one_prepared_idx" ON "public"."supplier_onboarding_followup_drafts" USING "btree" ("supplier_id") WHERE ("status" = 'prepared'::"text");



CREATE INDEX "supplier_onboarding_followup_drafts_prepared_idx" ON "public"."supplier_onboarding_followup_drafts" USING "btree" ("status", "prepared_at" DESC);



CREATE INDEX "supplier_onboarding_followups_due_idx" ON "public"."supplier_onboarding_followups" USING "btree" ("status", "next_followup_due_at") WHERE ("next_followup_due_at" IS NOT NULL);



CREATE INDEX "supplier_onboarding_followups_supplier_sent_idx" ON "public"."supplier_onboarding_followups" USING "btree" ("supplier_id", "sent_at" DESC);



CREATE INDEX "supplier_scout_jobs_queue_idx" ON "public"."supplier_scout_jobs" USING "btree" ("status", "queued_at");



CREATE UNIQUE INDEX "transfer_booking_pricing_ledger_checkout_intent_idx" ON "public"."transfer_booking_pricing_ledger" USING "btree" ("customer_user_id", "provider", "checkout_intent_key") WHERE ("checkout_intent_key" IS NOT NULL);



CREATE INDEX "transfer_booking_pricing_ledger_customer_idx" ON "public"."transfer_booking_pricing_ledger" USING "btree" ("customer_user_id", "created_at" DESC);



CREATE UNIQUE INDEX "transfer_booking_pricing_ledger_payment_ref_idx" ON "public"."transfer_booking_pricing_ledger" USING "btree" ("payment_provider", "payment_reference") WHERE ("payment_reference" IS NOT NULL);



CREATE UNIQUE INDEX "transfer_booking_pricing_ledger_prepared_idx" ON "public"."transfer_booking_pricing_ledger" USING "btree" ("prepared_booking_id");



CREATE INDEX "transfer_booking_pricing_ledger_provider_idx" ON "public"."transfer_booking_pricing_ledger" USING "btree" ("provider", "booking_status", "supplier_settlement_status");



CREATE INDEX "travel_refund_review_events_actor_idx" ON "public"."travel_refund_review_events" USING "btree" ("actor_user_id") WHERE ("actor_user_id" IS NOT NULL);



CREATE INDEX "travel_refund_review_events_review_idx" ON "public"."travel_refund_review_events" USING "btree" ("review_id", "id" DESC);



CREATE INDEX "travel_refund_reviews_assigned_to_idx" ON "public"."travel_refund_reviews" USING "btree" ("assigned_to") WHERE ("assigned_to" IS NOT NULL);



CREATE INDEX "travel_refund_reviews_resolved_by_idx" ON "public"."travel_refund_reviews" USING "btree" ("resolved_by") WHERE ("resolved_by" IS NOT NULL);



CREATE INDEX "travel_refund_reviews_status_idx" ON "public"."travel_refund_reviews" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "trip_items_appointment_id_idx" ON "public"."trip_items" USING "btree" ("appointment_id");



CREATE INDEX "trip_items_booking_id_cover_idx" ON "public"."trip_items" USING "btree" ("booking_id") WHERE ("booking_id" IS NOT NULL);



CREATE INDEX "trip_items_booking_id_idx" ON "public"."trip_items" USING "btree" ("booking_id");



CREATE INDEX "trip_items_city_id_idx" ON "public"."trip_items" USING "btree" ("city_id");



CREATE INDEX "trip_items_driver_transfer_request_idx" ON "public"."trip_items" USING "btree" ("driver_transfer_request_id") WHERE ("driver_transfer_request_id" IS NOT NULL);



CREATE INDEX "trip_items_event_id_idx" ON "public"."trip_items" USING "btree" ("event_id");



CREATE INDEX "trip_items_food_order_id_idx" ON "public"."trip_items" USING "btree" ("food_order_id");



CREATE INDEX "trip_items_hotel_ledger_idx" ON "public"."trip_items" USING "btree" ("hotel_booking_pricing_ledger_id") WHERE ("hotel_booking_pricing_ledger_id" IS NOT NULL);



CREATE INDEX "trip_items_item_kind_idx" ON "public"."trip_items" USING "btree" ("item_kind");



CREATE INDEX "trip_items_local_request_idx" ON "public"."trip_items" USING "btree" ("local_request_id") WHERE ("local_request_id" IS NOT NULL);



CREATE INDEX "trip_items_offering_id_idx" ON "public"."trip_items" USING "btree" ("offering_id");



CREATE UNIQUE INDEX "trip_items_trip_appointment_unique" ON "public"."trip_items" USING "btree" ("trip_id", "appointment_id") WHERE ("appointment_id" IS NOT NULL);



CREATE UNIQUE INDEX "trip_items_trip_event_uidx" ON "public"."trip_items" USING "btree" ("trip_id", "event_id") WHERE ("event_id" IS NOT NULL);



CREATE INDEX "trip_items_trip_id_position_idx" ON "public"."trip_items" USING "btree" ("trip_id", "position");



CREATE INDEX "trip_package_checkout_attempts_quote_idx" ON "public"."trip_package_checkout_attempts" USING "btree" ("quote_id", "created_at" DESC);



CREATE INDEX "trip_package_checkout_attempts_traveler_id_idx" ON "public"."trip_package_checkout_attempts" USING "btree" ("traveler_id");



CREATE INDEX "trip_package_checkout_attempts_trip_idx" ON "public"."trip_package_checkout_attempts" USING "btree" ("trip_id", "created_at" DESC);



CREATE INDEX "trip_package_payment_intents_checkout_attempt_id_idx" ON "public"."trip_package_payment_intents" USING "btree" ("checkout_attempt_id");



CREATE INDEX "trip_package_payment_intents_quote_id_idx" ON "public"."trip_package_payment_intents" USING "btree" ("quote_id");



CREATE INDEX "trip_package_payment_intents_trip_idx" ON "public"."trip_package_payment_intents" USING "btree" ("trip_id", "created_at" DESC);



CREATE INDEX "trip_package_quotes_traveler_id_idx" ON "public"."trip_package_quotes" USING "btree" ("traveler_id");



CREATE INDEX "trip_package_quotes_trip_idx" ON "public"."trip_package_quotes" USING "btree" ("trip_id", "created_at" DESC);



CREATE INDEX "trips_destination_city_id_idx" ON "public"."trips" USING "btree" ("destination_city_id");



CREATE UNIQUE INDEX "trips_share_token_unique" ON "public"."trips" USING "btree" ("share_token") WHERE ("share_token" IS NOT NULL);



CREATE INDEX "trips_traveler_id_idx" ON "public"."trips" USING "btree" ("traveler_id");



CREATE INDEX "trips_traveler_idx" ON "public"."trips" USING "btree" ("traveler_id", "created_at" DESC);



CREATE INDEX "vehicles_driver_idx" ON "public"."vehicles" USING "btree" ("driver_id");



CREATE INDEX "vehicles_insurance_expiry_idx" ON "public"."vehicles" USING "btree" ("insurance_expires_on") WHERE ("insurance_expires_on" IS NOT NULL);



CREATE INDEX "vehicles_provider_id_idx" ON "public"."vehicles" USING "btree" ("provider_id");



CREATE INDEX "vehicles_registration_expiry_idx" ON "public"."vehicles" USING "btree" ("registration_expires_on") WHERE ("registration_expires_on" IS NOT NULL);



CREATE UNIQUE INDEX "verification_cases_open_local_idx" ON "public"."verification_cases" USING "btree" ("subject_id") WHERE (("subject_type" = 'local'::"text") AND ("status" = ANY (ARRAY['not_started'::"text", 'pending'::"text", 'in_review'::"text"])));



CREATE UNIQUE INDEX "verification_cases_open_service_staff_idx" ON "public"."verification_cases" USING "btree" ("subject_id") WHERE (("subject_type" = 'service_staff'::"text") AND ("status" = ANY (ARRAY['not_started'::"text", 'pending'::"text", 'in_review'::"text"])));



CREATE UNIQUE INDEX "verification_cases_open_traveler_idx" ON "public"."verification_cases" USING "btree" ("subject_id") WHERE (("subject_type" = 'traveler'::"text") AND ("status" = ANY (ARRAY['not_started'::"text", 'pending'::"text", 'in_review'::"text"])));



CREATE INDEX "verification_cases_provider_subject_idx" ON "public"."verification_cases" USING "btree" ("subject_type", "subject_id", "status", "verification_level");



CREATE INDEX "verification_cases_status_idx" ON "public"."verification_cases" USING "btree" ("status");



CREATE INDEX "verification_cases_subject_idx" ON "public"."verification_cases" USING "btree" ("subject_type", "subject_id", "created_at" DESC);



CREATE INDEX "verification_events_case_idx" ON "public"."verification_events" USING "btree" ("case_id", "created_at");



CREATE UNIQUE INDEX "verification_events_provider_event_uidx" ON "public"."verification_events" USING "btree" ("provider", "provider_event_id") WHERE ("provider_event_id" IS NOT NULL);



CREATE INDEX "verification_evidence_case_idx" ON "public"."verification_evidence" USING "btree" ("case_id");



CREATE INDEX "verification_evidence_case_type_idx" ON "public"."verification_evidence" USING "btree" ("case_id", "evidence_type", "created_at" DESC);



CREATE INDEX "verification_evidence_case_type_status_idx" ON "public"."verification_evidence" USING "btree" ("case_id", "evidence_type", "status");



CREATE UNIQUE INDEX "verification_evidence_case_type_uidx" ON "public"."verification_evidence" USING "btree" ("case_id", "evidence_type");



CREATE OR REPLACE TRIGGER "activity_booking_pricing_ledger_updated_at" BEFORE UPDATE ON "public"."activity_booking_pricing_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."set_activity_booking_pricing_ledger_updated_at"();



CREATE OR REPLACE TRIGGER "ai_discovered_event_image_sanitize" BEFORE INSERT OR UPDATE OF "image_url" ON "public"."ai_discovered_events" FOR EACH ROW EXECUTE FUNCTION "public"."sanitize_ai_discovered_event_image"();



CREATE OR REPLACE TRIGGER "ai_scout_provider_retry_accounting" BEFORE UPDATE ON "public"."ai_scout_runs" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_ai_scout_provider_retry_accounting"();



CREATE OR REPLACE TRIGGER "businesses_sync_supplier_completion" AFTER INSERT OR UPDATE OF "name", "description", "phone", "email", "address", "website_url", "logo_url", "cover_image_url", "supplier_gallery_urls" ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."sync_supplier_completion_from_business"();



CREATE OR REPLACE TRIGGER "driver_assignments_require_booked" BEFORE INSERT ON "public"."driver_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."driver_assignment_booking_must_exist"();



CREATE OR REPLACE TRIGGER "driver_profiles_require_approved_verification" BEFORE INSERT OR UPDATE OF "verification_state", "identity_liveness_verified_at" ON "public"."driver_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."driver_require_approved_verification"();



CREATE CONSTRAINT TRIGGER "driver_require_activation_compliance" AFTER INSERT OR UPDATE OF "service_status", "verification_state", "driving_license_compliance_status" ON "public"."driver_profiles" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."driver_require_activation_compliance"();



CREATE CONSTRAINT TRIGGER "driver_require_vehicle_compliance_for_active" AFTER INSERT OR DELETE OR UPDATE OF "status", "registration_compliance_status", "insurance_compliance_status" ON "public"."vehicles" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."driver_require_vehicle_compliance_for_active"();



CREATE OR REPLACE TRIGGER "enforce_food_order_payment_lifecycle" BEFORE UPDATE OF "status" ON "public"."food_orders" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_food_order_payment_lifecycle"();



CREATE OR REPLACE TRIGGER "events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."update_events_updated_at"();



CREATE OR REPLACE TRIGGER "food_delivery_assignments_updated_at" BEFORE UPDATE ON "public"."food_delivery_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_restaurant_food_updated_at"();



CREATE OR REPLACE TRIGGER "food_orders_updated_at" BEFORE UPDATE ON "public"."food_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_restaurant_food_updated_at"();



CREATE OR REPLACE TRIGGER "hotel_booking_pricing_ledger_updated_at" BEFORE UPDATE ON "public"."hotel_booking_pricing_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."set_hotel_booking_pricing_ledger_updated_at"();



CREATE OR REPLACE TRIGGER "hotelbeds_content_sync_state_updated_at" BEFORE UPDATE ON "public"."hotelbeds_content_sync_state" FOR EACH ROW EXECUTE FUNCTION "public"."set_hotelbeds_content_updated_at"();



CREATE OR REPLACE TRIGGER "hotelbeds_hotel_content_updated_at" BEFORE UPDATE ON "public"."hotelbeds_hotel_content" FOR EACH ROW EXECUTE FUNCTION "public"."set_hotelbeds_content_updated_at"();



CREATE OR REPLACE TRIGGER "local_require_approved_verification_trg" BEFORE INSERT OR UPDATE OF "verification_state", "identity_liveness_verified_at" ON "public"."local_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."local_require_approved_verification"();



CREATE OR REPLACE TRIGGER "protect_food_order_payment_state" BEFORE UPDATE OF "payment_status" ON "public"."food_orders" FOR EACH ROW EXECUTE FUNCTION "public"."protect_food_order_payment_state"();



CREATE OR REPLACE TRIGGER "protect_trip_item_service_appointment_mutation" BEFORE UPDATE ON "public"."trip_items" FOR EACH ROW EXECUTE FUNCTION "public"."protect_trip_item_service_appointment_mutation"();



CREATE OR REPLACE TRIGGER "restaurant_menu_categories_updated_at" BEFORE UPDATE ON "public"."restaurant_menu_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_restaurant_food_updated_at"();



CREATE OR REPLACE TRIGGER "restaurant_menu_items_updated_at" BEFORE UPDATE ON "public"."restaurant_menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_restaurant_food_updated_at"();



CREATE OR REPLACE TRIGGER "restaurant_settings_updated_at" BEFORE UPDATE ON "public"."restaurant_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_restaurant_food_updated_at"();



CREATE OR REPLACE TRIGGER "service_appointment_require_verified_traveler" BEFORE INSERT OR UPDATE OF "customer_user_id" ON "public"."service_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."service_appointment_require_verified_traveler"();



CREATE OR REPLACE TRIGGER "service_appointment_status_notification_trigger" AFTER INSERT ON "public"."service_appointment_status_events" FOR EACH ROW EXECUTE FUNCTION "public"."create_service_appointment_notifications"();



CREATE OR REPLACE TRIGGER "service_appointments_calculate_provider_fee" BEFORE INSERT OR UPDATE OF "service_profile_id", "price" ON "public"."service_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_service_provider_fee"();



CREATE OR REPLACE TRIGGER "service_appointments_mark_payout_eligible" AFTER UPDATE OF "status" ON "public"."service_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."mark_service_provider_payout_eligible"();



CREATE OR REPLACE TRIGGER "service_appointments_sync_payment_ledger" AFTER INSERT OR UPDATE OF "price", "currency", "service_fee_percent", "service_fee_amount", "provider_net_amount", "payment_status" ON "public"."service_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_service_payment_ledger"();



CREATE OR REPLACE TRIGGER "service_appointments_validate_time_window" BEFORE INSERT OR UPDATE OF "starts_at", "ends_at", "staff_id", "service_profile_id", "offering_id" ON "public"."service_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."validate_service_appointment_time_window"();



CREATE OR REPLACE TRIGGER "service_profiles_require_provider_terms" BEFORE INSERT OR UPDATE OF "booking_status", "provider_terms_version", "provider_terms_accepted_at" ON "public"."service_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_service_provider_terms_before_booking"();



CREATE OR REPLACE TRIGGER "service_profiles_sync_supplier_completion" AFTER INSERT OR DELETE OR UPDATE OF "business_id" ON "public"."service_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_supplier_completion_from_service_profile"();



CREATE OR REPLACE TRIGGER "service_provider_payouts_require_verification" BEFORE UPDATE OF "status" ON "public"."service_provider_payouts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_service_provider_payout_verification"();



CREATE OR REPLACE TRIGGER "service_staff_require_external_verification_trg" BEFORE INSERT OR UPDATE OF "verification_state", "identity_liveness_verified_at", "user_id" ON "public"."service_staff" FOR EACH ROW EXECUTE FUNCTION "public"."service_staff_require_external_verification"();



CREATE OR REPLACE TRIGGER "supplier_accounts_set_completion" BEFORE INSERT OR UPDATE OF "business_id" ON "public"."supplier_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_supplier_completion_on_account"();



CREATE OR REPLACE TRIGGER "sync_food_order_delivery_assignment" AFTER UPDATE OF "status" ON "public"."food_orders" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."sync_food_order_delivery_assignment"();



CREATE OR REPLACE TRIGGER "sync_service_appointment_journey_times" AFTER UPDATE OF "starts_at", "ends_at" ON "public"."service_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_service_appointment_journey_times"();



CREATE OR REPLACE TRIGGER "transfer_booking_pricing_ledger_updated_at" BEFORE UPDATE ON "public"."transfer_booking_pricing_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."set_transfer_booking_pricing_ledger_updated_at"();



CREATE OR REPLACE TRIGGER "travel_os_bookings_approved_event" BEFORE INSERT OR UPDATE OF "event_id" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."travel_os_require_approved_event"();



CREATE OR REPLACE TRIGGER "travel_os_bookings_approved_offering" BEFORE INSERT OR UPDATE OF "offering_id" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."travel_os_require_approved_offering"();



CREATE OR REPLACE TRIGGER "travel_os_bookings_audit" AFTER INSERT OR UPDATE OF "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."travel_os_log_booking_status"();



CREATE OR REPLACE TRIGGER "travel_os_bookings_lock_user" BEFORE INSERT OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."travel_os_lock_user_booking"();



CREATE OR REPLACE TRIGGER "travel_os_offerings_approved_event" BEFORE INSERT OR UPDATE OF "event_id" ON "public"."offerings" FOR EACH ROW EXECUTE FUNCTION "public"."travel_os_require_approved_event"();



CREATE OR REPLACE TRIGGER "travel_os_trip_items_approved_event" BEFORE INSERT OR UPDATE OF "event_id" ON "public"."trip_items" FOR EACH ROW EXECUTE FUNCTION "public"."travel_os_require_approved_event"();



CREATE OR REPLACE TRIGGER "travel_os_trip_items_approved_offering" BEFORE INSERT OR UPDATE OF "offering_id" ON "public"."trip_items" FOR EACH ROW EXECUTE FUNCTION "public"."travel_os_require_approved_offering"();



CREATE OR REPLACE TRIGGER "travel_refund_review_audit_trigger" AFTER INSERT OR UPDATE ON "public"."travel_refund_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."capture_travel_refund_review_event"();



CREATE OR REPLACE TRIGGER "trip_items_sync_hotel_ledger_reference" BEFORE INSERT OR UPDATE ON "public"."trip_items" FOR EACH ROW EXECUTE FUNCTION "public"."sync_hotel_trip_item_ledger_reference"();



CREATE OR REPLACE TRIGGER "validate_food_order_item_amounts" BEFORE INSERT OR UPDATE OF "unit_price", "quantity", "line_total" ON "public"."food_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."validate_food_order_item_amounts"();



CREATE OR REPLACE TRIGGER "validate_restaurant_menu_item_category" BEFORE INSERT OR UPDATE OF "business_id", "category_id" ON "public"."restaurant_menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."validate_restaurant_menu_item_category"();



CREATE OR REPLACE TRIGGER "verification_events_no_update" BEFORE DELETE OR UPDATE ON "public"."verification_events" FOR EACH ROW EXECUTE FUNCTION "public"."verification_events_immutable"();



ALTER TABLE ONLY "public"."activity_booking_pricing_ledger"
    ADD CONSTRAINT "activity_booking_pricing_ledger_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_event_itineraries"
    ADD CONSTRAINT "ai_event_itineraries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."ai_discovered_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_sales_outreach"
    ADD CONSTRAINT "ai_sales_outreach_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."ai_sales_prospects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_status_events"
    ADD CONSTRAINT "booking_status_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_activities"
    ADD CONSTRAINT "crm_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_activities"
    ADD CONSTRAINT "crm_activities_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."safari_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_activities"
    ADD CONSTRAINT "crm_activities_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."ai_sales_prospects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_contacts"
    ADD CONSTRAINT "crm_contacts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."safari_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_contacts"
    ADD CONSTRAINT "crm_contacts_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."ai_sales_prospects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_conversions"
    ADD CONSTRAINT "crm_conversions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."safari_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_conversions"
    ADD CONSTRAINT "crm_conversions_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."ai_sales_prospects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_followups"
    ADD CONSTRAINT "crm_followups_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_followups"
    ADD CONSTRAINT "crm_followups_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."safari_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_followups"
    ADD CONSTRAINT "crm_followups_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."ai_sales_prospects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discoveries"
    ADD CONSTRAINT "discoveries_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."driver_assignments"
    ADD CONSTRAINT "driver_assignments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_assignments"
    ADD CONSTRAINT "driver_assignments_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."driver_profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."driver_assignments"
    ADD CONSTRAINT "driver_assignments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."driver_availability"
    ADD CONSTRAINT "driver_availability_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."driver_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_compliance_alerts"
    ADD CONSTRAINT "driver_compliance_alerts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."driver_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_compliance_alerts"
    ADD CONSTRAINT "driver_compliance_alerts_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_profiles"
    ADD CONSTRAINT "driver_profiles_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."driver_profiles"
    ADD CONSTRAINT "driver_profiles_service_city_id_fkey" FOREIGN KEY ("service_city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."driver_profiles"
    ADD CONSTRAINT "driver_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."driver_transfer_rates"
    ADD CONSTRAINT "driver_transfer_rates_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."driver_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_transfer_requests"
    ADD CONSTRAINT "driver_transfer_requests_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."driver_profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."driver_transfer_requests"
    ADD CONSTRAINT "driver_transfer_requests_transfer_rate_id_fkey" FOREIGN KEY ("transfer_rate_id") REFERENCES "public"."driver_transfer_rates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."driver_transfer_requests"
    ADD CONSTRAINT "driver_transfer_requests_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_transfer_requests"
    ADD CONSTRAINT "driver_transfer_requests_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."food_delivery_assignments"
    ADD CONSTRAINT "food_delivery_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."food_delivery_assignments"
    ADD CONSTRAINT "food_delivery_assignments_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."driver_profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."food_delivery_assignments"
    ADD CONSTRAINT "food_delivery_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."food_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_delivery_assignments"
    ADD CONSTRAINT "food_delivery_assignments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."food_order_item_options"
    ADD CONSTRAINT "food_order_item_options_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."food_order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_order_items"
    ADD CONSTRAINT "food_order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."restaurant_menu_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."food_order_items"
    ADD CONSTRAINT "food_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."food_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_order_payment_idempotency"
    ADD CONSTRAINT "food_order_payment_idempotency_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_order_payment_idempotency"
    ADD CONSTRAINT "food_order_payment_idempotency_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."food_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_order_refunds"
    ADD CONSTRAINT "food_order_refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."food_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_orders"
    ADD CONSTRAINT "food_orders_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."food_orders"
    ADD CONSTRAINT "food_orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."food_orders"
    ADD CONSTRAINT "food_orders_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."food_orders"
    ADD CONSTRAINT "food_orders_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hotel_booking_pricing_ledger"
    ADD CONSTRAINT "hotel_booking_pricing_ledger_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hotel_checkout_intents"
    ADD CONSTRAINT "hotel_checkout_intents_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hotel_checkout_intents"
    ADD CONSTRAINT "hotel_checkout_intents_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "public"."hotel_booking_pricing_ledger"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."integration_syncs"
    ADD CONSTRAINT "integration_syncs_safariplug_event_id_fkey" FOREIGN KEY ("safariplug_event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_articles"
    ADD CONSTRAINT "journal_articles_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."local_availability"
    ADD CONSTRAINT "local_availability_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "public"."local_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_profiles"
    ADD CONSTRAINT "local_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_requests"
    ADD CONSTRAINT "local_requests_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "public"."local_profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."local_requests"
    ADD CONSTRAINT "local_requests_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_requests"
    ADD CONSTRAINT "local_requests_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offerings"
    ADD CONSTRAINT "offerings_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offerings"
    ADD CONSTRAINT "offerings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offerings"
    ADD CONSTRAINT "offerings_kind_fkey" FOREIGN KEY ("kind") REFERENCES "public"."inventory_kinds"("slug");



ALTER TABLE ONLY "public"."offerings"
    ADD CONSTRAINT "offerings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."partner_invitations"
    ADD CONSTRAINT "partner_invitations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."partner_invitations"
    ADD CONSTRAINT "partner_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."partner_invitations"
    ADD CONSTRAINT "partner_invitations_onboarded_user_id_fkey" FOREIGN KEY ("onboarded_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."partner_invitations"
    ADD CONSTRAINT "partner_invitations_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."safari_partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."partner_invitations"
    ADD CONSTRAINT "partner_invitations_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."ai_sales_prospects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."price_quotes"
    ADD CONSTRAINT "price_quotes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."price_quotes"
    ADD CONSTRAINT "price_quotes_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_auth_users_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."push_notification_tokens"
    ADD CONSTRAINT "push_notification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_menu_categories"
    ADD CONSTRAINT "restaurant_menu_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_menu_item_option_values"
    ADD CONSTRAINT "restaurant_menu_item_option_values_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."restaurant_menu_item_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_menu_item_options"
    ADD CONSTRAINT "restaurant_menu_item_options_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."restaurant_menu_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_menu_items"
    ADD CONSTRAINT "restaurant_menu_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_menu_items"
    ADD CONSTRAINT "restaurant_menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."restaurant_menu_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."restaurant_settings"
    ADD CONSTRAINT "restaurant_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_appointment_notifications"
    ADD CONSTRAINT "service_appointment_notifications_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."service_appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_appointment_notifications"
    ADD CONSTRAINT "service_appointment_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_appointment_status_events"
    ADD CONSTRAINT "service_appointment_status_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_appointment_status_events"
    ADD CONSTRAINT "service_appointment_status_events_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."service_appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_appointments"
    ADD CONSTRAINT "service_appointments_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_appointments"
    ADD CONSTRAINT "service_appointments_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "public"."service_offerings"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."service_appointments"
    ADD CONSTRAINT "service_appointments_service_profile_id_fkey" FOREIGN KEY ("service_profile_id") REFERENCES "public"."service_profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."service_appointments"
    ADD CONSTRAINT "service_appointments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."service_staff"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."service_appointments"
    ADD CONSTRAINT "service_appointments_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_offerings"
    ADD CONSTRAINT "service_offerings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_offerings"
    ADD CONSTRAINT "service_offerings_service_profile_id_fkey" FOREIGN KEY ("service_profile_id") REFERENCES "public"."service_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_payment_events"
    ADD CONSTRAINT "service_payment_events_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."service_appointments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."service_payment_idempotency"
    ADD CONSTRAINT "service_payment_idempotency_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."service_appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_payment_idempotency"
    ADD CONSTRAINT "service_payment_idempotency_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_payment_ledger"
    ADD CONSTRAINT "service_payment_ledger_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."service_appointments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."service_profiles"
    ADD CONSTRAINT "service_profiles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_profiles"
    ADD CONSTRAINT "service_profiles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_profiles"
    ADD CONSTRAINT "service_profiles_provider_terms_accepted_by_fkey" FOREIGN KEY ("provider_terms_accepted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."service_provider_payout_accounts"
    ADD CONSTRAINT "service_provider_payout_accounts_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_provider_payout_accounts"
    ADD CONSTRAINT "service_provider_payout_accounts_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."service_provider_payouts"
    ADD CONSTRAINT "service_provider_payouts_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."service_appointments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."service_provider_payouts"
    ADD CONSTRAINT "service_provider_payouts_approval_user_id_fkey" FOREIGN KEY ("approval_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."service_provider_payouts"
    ADD CONSTRAINT "service_provider_payouts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."service_provider_payouts"
    ADD CONSTRAINT "service_provider_payouts_payout_phone_verified_by_fkey" FOREIGN KEY ("payout_phone_verified_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."service_provider_payouts"
    ADD CONSTRAINT "service_provider_payouts_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_provider_payouts"
    ADD CONSTRAINT "service_provider_payouts_service_profile_id_fkey" FOREIGN KEY ("service_profile_id") REFERENCES "public"."service_profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."service_staff_availability"
    ADD CONSTRAINT "service_staff_availability_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."service_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_staff_blockouts"
    ADD CONSTRAINT "service_staff_blockouts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."service_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_staff_claim_tokens"
    ADD CONSTRAINT "service_staff_claim_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_staff_claim_tokens"
    ADD CONSTRAINT "service_staff_claim_tokens_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."service_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_staff_offerings"
    ADD CONSTRAINT "service_staff_offerings_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "public"."service_offerings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_staff_offerings"
    ADD CONSTRAINT "service_staff_offerings_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."service_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_staff"
    ADD CONSTRAINT "service_staff_service_profile_id_fkey" FOREIGN KEY ("service_profile_id") REFERENCES "public"."service_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_staff"
    ADD CONSTRAINT "service_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sources"
    ADD CONSTRAINT "sources_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supplier_accounts"
    ADD CONSTRAINT "supplier_accounts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_accounts"
    ADD CONSTRAINT "supplier_accounts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."safari_partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supplier_accounts"
    ADD CONSTRAINT "supplier_accounts_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."ai_sales_prospects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supplier_accounts"
    ADD CONSTRAINT "supplier_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_onboarding_followup_drafts"
    ADD CONSTRAINT "supplier_onboarding_followup_drafts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_onboarding_followups"
    ADD CONSTRAINT "supplier_onboarding_followups_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transfer_booking_pricing_ledger"
    ADD CONSTRAINT "transfer_booking_pricing_ledger_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_refund_review_events"
    ADD CONSTRAINT "travel_refund_review_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."travel_refund_review_events"
    ADD CONSTRAINT "travel_refund_review_events_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."travel_refund_reviews"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."travel_refund_reviews"
    ADD CONSTRAINT "travel_refund_reviews_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."travel_refund_reviews"
    ADD CONSTRAINT "travel_refund_reviews_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."service_appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_driver_transfer_request_id_fkey" FOREIGN KEY ("driver_transfer_request_id") REFERENCES "public"."driver_transfer_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_food_order_id_fkey" FOREIGN KEY ("food_order_id") REFERENCES "public"."food_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_hotel_booking_pricing_ledger_id_fkey" FOREIGN KEY ("hotel_booking_pricing_ledger_id") REFERENCES "public"."hotel_booking_pricing_ledger"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_item_kind_fkey" FOREIGN KEY ("item_kind") REFERENCES "public"."inventory_kinds"("slug");



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_local_request_id_fkey" FOREIGN KEY ("local_request_id") REFERENCES "public"."local_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_items"
    ADD CONSTRAINT "trip_items_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_package_checkout_attempts"
    ADD CONSTRAINT "trip_package_checkout_attempts_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."trip_package_quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_package_checkout_attempts"
    ADD CONSTRAINT "trip_package_checkout_attempts_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_package_checkout_attempts"
    ADD CONSTRAINT "trip_package_checkout_attempts_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_package_payment_intents"
    ADD CONSTRAINT "trip_package_payment_intents_checkout_attempt_id_fkey" FOREIGN KEY ("checkout_attempt_id") REFERENCES "public"."trip_package_checkout_attempts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_package_payment_intents"
    ADD CONSTRAINT "trip_package_payment_intents_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."trip_package_quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_package_payment_intents"
    ADD CONSTRAINT "trip_package_payment_intents_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_package_payment_intents"
    ADD CONSTRAINT "trip_package_payment_intents_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_package_quotes"
    ADD CONSTRAINT "trip_package_quotes_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_package_quotes"
    ADD CONSTRAINT "trip_package_quotes_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_destination_city_id_fkey" FOREIGN KEY ("destination_city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."driver_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."verification_events"
    ADD CONSTRAINT "verification_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."verification_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."verification_evidence"
    ADD CONSTRAINT "verification_evidence_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."verification_cases"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can create AI scans" ON "public"."ai_scans" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can create AI scout runs" ON "public"."ai_scout_runs" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete events" ON "public"."events" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can manage safari_partners" ON "public"."safari_partners" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can read AI discoveries" ON "public"."ai_discovered_events" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can update events" ON "public"."events" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can view AI scans" ON "public"."ai_scans" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can view AI scout runs" ON "public"."ai_scout_runs" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Authenticated users can submit events" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR (("submitted_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'pending'::"text") AND ("featured" = false)) OR (("submitted_by" IS NULL) AND ("status" = 'pending'::"text") AND ("featured" = false))));



CREATE POLICY "Partners can create own business" ON "public"."businesses" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Partners can read own business" ON "public"."businesses" FOR SELECT TO "authenticated" USING (("owner_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Partners can update own business" ON "public"."businesses" FOR UPDATE TO "authenticated" USING (("owner_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("owner_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Public can read active cities" ON "public"."cities" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



CREATE POLICY "Public can read active providers" ON "public"."providers" FOR SELECT USING (("status" = 'active'::"text"));



CREATE POLICY "Public can read approved offerings" ON "public"."offerings" FOR SELECT USING (("status" = 'approved'::"text"));



CREATE POLICY "Public can read inventory kinds" ON "public"."inventory_kinds" FOR SELECT USING (true);



CREATE POLICY "Public can read published journal articles" ON "public"."journal_articles" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "Public can submit unclaimed pending events" ON "public"."events" FOR INSERT TO "anon" WITH CHECK ((("submitted_by" IS NULL) AND ("status" = 'pending'::"text") AND ("featured" = false)));



CREATE POLICY "Users can create own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read permitted events" ON "public"."events" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'approved'::"text") OR ( SELECT "public"."is_admin"() AS "is_admin") OR ("submitted_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can update own appointment notifications" ON "public"."service_appointment_notifications" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view own appointment notifications" ON "public"."service_appointment_notifications" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users insert own bookings" ON "public"."bookings" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "traveler_id") AND ("status" = 'quote'::"text") AND ("supplier_reference" IS NULL)));



CREATE POLICY "Users insert own trips" ON "public"."trips" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "traveler_id") AND ("status" = 'draft'::"text")));



CREATE POLICY "Users manage their own push tokens" ON "public"."push_notification_tokens" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users read own booking audit" ON "public"."booking_status_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."id" = "booking_status_events"."booking_id") AND ("b"."traveler_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users read own bookings" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "traveler_id"));



CREATE POLICY "Users read own trip items" ON "public"."trip_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_items"."trip_id") AND ("t"."traveler_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users read own trips" ON "public"."trips" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "traveler_id"));



CREATE POLICY "Users write own trip items" ON "public"."trip_items" FOR INSERT TO "authenticated" WITH CHECK ((("booking_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_items"."trip_id") AND ("t"."traveler_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."activity_booking_pricing_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_telemetry_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_users_self_select" ON "public"."admin_users" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."ai_discovered_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_event_itineraries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_sales_outreach" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_sales_prospects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_scans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_scout_locks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_scout_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon reads eligible active transfer rates" ON "public"."driver_transfer_rates" FOR SELECT TO "anon" USING ((("status" = 'active'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."driver_profiles" "d"
  WHERE (("d"."id" = "driver_transfer_rates"."driver_id") AND ("d"."service_status" = 'active'::"text") AND ("d"."verification_state" = 'verified'::"text") AND ("d"."identity_liveness_verified_at" IS NOT NULL) AND ("d"."personal_photo_url" IS NOT NULL) AND ("d"."driving_license_compliance_status" = ANY (ARRAY['valid'::"text", 'expiring_soon'::"text"])))))));



CREATE POLICY "anonymous can view active verified locals" ON "public"."local_profiles" FOR SELECT TO "anon" USING ((("service_status" = 'active'::"text") AND ("verification_state" = 'verified'::"text") AND ("identity_liveness_verified_at" IS NOT NULL)));



CREATE POLICY "anonymous can view verified local availability" ON "public"."local_availability" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."local_profiles" "p"
  WHERE (("p"."id" = "local_availability"."local_id") AND ("p"."service_status" = 'active'::"text") AND ("p"."verification_state" = 'verified'::"text") AND ("p"."identity_liveness_verified_at" IS NOT NULL)))));



ALTER TABLE "public"."aurelian_feed_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated local availability read" ON "public"."local_availability" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."local_profiles" "p"
  WHERE (("p"."id" = "local_availability"."local_id") AND ((("p"."service_status" = 'active'::"text") AND ("p"."verification_state" = 'verified'::"text") AND ("p"."identity_liveness_verified_at" IS NOT NULL)) OR ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "authenticated reads eligible or own transfer rates" ON "public"."driver_transfer_rates" FOR SELECT TO "authenticated" USING (((("status" = 'active'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."driver_profiles" "d"
  WHERE (("d"."id" = "driver_transfer_rates"."driver_id") AND ("d"."service_status" = 'active'::"text") AND ("d"."verification_state" = 'verified'::"text") AND ("d"."identity_liveness_verified_at" IS NOT NULL) AND ("d"."personal_photo_url" IS NOT NULL) AND ("d"."driving_license_compliance_status" = ANY (ARRAY['valid'::"text", 'expiring_soon'::"text"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."driver_profiles" "d"
  WHERE (("d"."id" = "driver_transfer_rates"."driver_id") AND ("d"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."booking_status_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."concierge_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_conversions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_followups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discoveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_compliance_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_transfer_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_transfer_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "drivers delete own transfer rates" ON "public"."driver_transfer_rates" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."driver_profiles" "d"
  WHERE (("d"."id" = "driver_transfer_rates"."driver_id") AND ("d"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "drivers insert own transfer rates" ON "public"."driver_transfer_rates" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."driver_profiles" "d"
  WHERE (("d"."id" = "driver_transfer_rates"."driver_id") AND ("d"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "drivers update own transfer rates" ON "public"."driver_transfer_rates" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."driver_profiles" "d"
  WHERE (("d"."id" = "driver_transfer_rates"."driver_id") AND ("d"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."driver_profiles" "d"
  WHERE (("d"."id" = "driver_transfer_rates"."driver_id") AND ("d"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_delivery_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "food_delivery_driver_or_supplier_update" ON "public"."food_delivery_assignments" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."driver_profiles" "d"
  WHERE (("d"."id" = "food_delivery_assignments"."driver_id") AND ("d"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM ("public"."food_orders" "o"
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "o"."business_id")))
  WHERE (("o"."id" = "food_delivery_assignments"."order_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."driver_profiles" "d"
  WHERE (("d"."id" = "food_delivery_assignments"."driver_id") AND ("d"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM ("public"."food_orders" "o"
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "o"."business_id")))
  WHERE (("o"."id" = "food_delivery_assignments"."order_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "food_delivery_participant_read" ON "public"."food_delivery_assignments" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."food_orders" "o"
  WHERE (("o"."id" = "food_delivery_assignments"."order_id") AND ("o"."customer_user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."driver_profiles" "d"
  WHERE (("d"."id" = "food_delivery_assignments"."driver_id") AND ("d"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM ("public"."food_orders" "o"
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "o"."business_id")))
  WHERE (("o"."id" = "food_delivery_assignments"."order_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "food_delivery_supplier_delete" ON "public"."food_delivery_assignments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."food_orders" "o"
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "o"."business_id")))
  WHERE (("o"."id" = "food_delivery_assignments"."order_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "food_delivery_supplier_insert" ON "public"."food_delivery_assignments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."food_orders" "o"
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "o"."business_id")))
  WHERE (("o"."id" = "food_delivery_assignments"."order_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."food_order_item_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "food_order_item_options_participant_read" ON "public"."food_order_item_options" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."food_order_items" "oi"
     JOIN "public"."food_orders" "o" ON (("o"."id" = "oi"."order_id")))
  WHERE (("oi"."id" = "food_order_item_options"."order_item_id") AND ("o"."customer_user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM (("public"."food_order_items" "oi"
     JOIN "public"."food_orders" "o" ON (("o"."id" = "oi"."order_id")))
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "o"."business_id")))
  WHERE (("oi"."id" = "food_order_item_options"."order_item_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."food_order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "food_order_items_participant_read" ON "public"."food_order_items" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."food_orders" "o"
  WHERE (("o"."id" = "food_order_items"."order_id") AND ("o"."customer_user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM ("public"."food_orders" "o"
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "o"."business_id")))
  WHERE (("o"."id" = "food_order_items"."order_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."food_order_payment_idempotency" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_order_refunds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "food_orders_participant_read" ON "public"."food_orders" FOR SELECT TO "authenticated" USING ((("customer_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "food_orders"."business_id"))))));



CREATE POLICY "food_orders_supplier_update" ON "public"."food_orders" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "food_orders"."business_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "food_orders"."business_id")))));



ALTER TABLE "public"."hotel_booking_pricing_ledger" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hotel_booking_pricing_ledger_customer_select" ON "public"."hotel_booking_pricing_ledger" FOR SELECT TO "authenticated" USING (("customer_user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."hotel_checkout_intents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hotelbeds_content_sync_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hotelbeds_hotel_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_syncs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_kinds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "local request participant read" ON "public"."local_requests" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "traveler_id") OR (EXISTS ( SELECT 1
   FROM "public"."local_profiles" "p"
  WHERE (("p"."id" = "local_requests"."local_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "local request participant update" ON "public"."local_requests" FOR UPDATE TO "authenticated" USING ((("traveler_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."local_profiles" "p"
  WHERE (("p"."id" = "local_requests"."local_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK (((("traveler_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'cancelled'::"text")) OR ((EXISTS ( SELECT 1
   FROM "public"."local_profiles" "p"
  WHERE (("p"."id" = "local_requests"."local_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) AND ("status" = ANY (ARRAY['accepted'::"text", 'declined'::"text"])))));



ALTER TABLE "public"."local_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."local_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."local_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "locals can create own profile" ON "public"."local_profiles" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("verification_state" = 'unverified'::"text") AND ("service_status" = 'draft'::"text")));



CREATE POLICY "locals can update own non-active profile" ON "public"."local_profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("service_status" <> 'active'::"text") AND ("verification_state" <> 'verified'::"text")));



CREATE POLICY "locals delete own availability" ON "public"."local_availability" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."local_profiles" "p"
  WHERE (("p"."id" = "local_availability"."local_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "locals insert own availability" ON "public"."local_availability" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."local_profiles" "p"
  WHERE (("p"."id" = "local_availability"."local_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "locals profile read access" ON "public"."local_profiles" FOR SELECT TO "authenticated" USING (((("service_status" = 'active'::"text") AND ("verification_state" = 'verified'::"text") AND ("identity_liveness_verified_at" IS NOT NULL)) OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



CREATE POLICY "locals update own availability" ON "public"."local_availability" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."local_profiles" "p"
  WHERE (("p"."id" = "local_availability"."local_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."local_profiles" "p"
  WHERE (("p"."id" = "local_availability"."local_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."marketing_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offerings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promotions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_notification_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurant_categories_anon_read" ON "public"."restaurant_menu_categories" FOR SELECT TO "anon" USING (("active" AND (EXISTS ( SELECT 1
   FROM "public"."restaurant_settings" "s"
  WHERE (("s"."business_id" = "restaurant_menu_categories"."business_id") AND "s"."ordering_enabled")))));



CREATE POLICY "restaurant_categories_authenticated_read" ON "public"."restaurant_menu_categories" FOR SELECT TO "authenticated" USING ((("active" AND (EXISTS ( SELECT 1
   FROM "public"."restaurant_settings" "s"
  WHERE (("s"."business_id" = "restaurant_menu_categories"."business_id") AND "s"."ordering_enabled")))) OR (EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "restaurant_menu_categories"."business_id"))))));



CREATE POLICY "restaurant_categories_supplier_delete" ON "public"."restaurant_menu_categories" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "restaurant_menu_categories"."business_id")))));



CREATE POLICY "restaurant_categories_supplier_insert" ON "public"."restaurant_menu_categories" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "restaurant_menu_categories"."business_id")))));



CREATE POLICY "restaurant_categories_supplier_update" ON "public"."restaurant_menu_categories" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "restaurant_menu_categories"."business_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "restaurant_menu_categories"."business_id")))));



CREATE POLICY "restaurant_items_anon_read" ON "public"."restaurant_menu_items" FOR SELECT TO "anon" USING (("active" AND "available" AND (EXISTS ( SELECT 1
   FROM "public"."restaurant_settings" "s"
  WHERE (("s"."business_id" = "restaurant_menu_items"."business_id") AND "s"."ordering_enabled")))));



CREATE POLICY "restaurant_items_authenticated_read" ON "public"."restaurant_menu_items" FOR SELECT TO "authenticated" USING ((("active" AND "available" AND (EXISTS ( SELECT 1
   FROM "public"."restaurant_settings" "s"
  WHERE (("s"."business_id" = "restaurant_menu_items"."business_id") AND "s"."ordering_enabled")))) OR (EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "restaurant_menu_items"."business_id"))))));



CREATE POLICY "restaurant_items_supplier_delete" ON "public"."restaurant_menu_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "restaurant_menu_items"."business_id")))));



CREATE POLICY "restaurant_items_supplier_insert" ON "public"."restaurant_menu_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "restaurant_menu_items"."business_id")))));



CREATE POLICY "restaurant_items_supplier_update" ON "public"."restaurant_menu_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "restaurant_menu_items"."business_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "restaurant_menu_items"."business_id")))));



ALTER TABLE "public"."restaurant_menu_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_menu_item_option_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_menu_item_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_menu_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurant_option_values_anon_read" ON "public"."restaurant_menu_item_option_values" FOR SELECT TO "anon" USING (("active" AND (EXISTS ( SELECT 1
   FROM (("public"."restaurant_menu_item_options" "o"
     JOIN "public"."restaurant_menu_items" "i" ON (("i"."id" = "o"."menu_item_id")))
     JOIN "public"."restaurant_settings" "s" ON (("s"."business_id" = "i"."business_id")))
  WHERE (("o"."id" = "restaurant_menu_item_option_values"."option_id") AND "o"."active" AND "i"."active" AND "i"."available" AND "s"."ordering_enabled")))));



CREATE POLICY "restaurant_option_values_authenticated_read" ON "public"."restaurant_menu_item_option_values" FOR SELECT TO "authenticated" USING ((("active" AND (EXISTS ( SELECT 1
   FROM (("public"."restaurant_menu_item_options" "o"
     JOIN "public"."restaurant_menu_items" "i" ON (("i"."id" = "o"."menu_item_id")))
     JOIN "public"."restaurant_settings" "s" ON (("s"."business_id" = "i"."business_id")))
  WHERE (("o"."id" = "restaurant_menu_item_option_values"."option_id") AND "o"."active" AND "i"."active" AND "i"."available" AND "s"."ordering_enabled")))) OR (EXISTS ( SELECT 1
   FROM (("public"."restaurant_menu_item_options" "o"
     JOIN "public"."restaurant_menu_items" "i" ON (("i"."id" = "o"."menu_item_id")))
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "i"."business_id")))
  WHERE (("o"."id" = "restaurant_menu_item_option_values"."option_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "restaurant_option_values_supplier_delete" ON "public"."restaurant_menu_item_option_values" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."restaurant_menu_item_options" "o"
     JOIN "public"."restaurant_menu_items" "i" ON (("i"."id" = "o"."menu_item_id")))
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "i"."business_id")))
  WHERE (("o"."id" = "restaurant_menu_item_option_values"."option_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "restaurant_option_values_supplier_insert" ON "public"."restaurant_menu_item_option_values" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."restaurant_menu_item_options" "o"
     JOIN "public"."restaurant_menu_items" "i" ON (("i"."id" = "o"."menu_item_id")))
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "i"."business_id")))
  WHERE (("o"."id" = "restaurant_menu_item_option_values"."option_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "restaurant_option_values_supplier_update" ON "public"."restaurant_menu_item_option_values" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."restaurant_menu_item_options" "o"
     JOIN "public"."restaurant_menu_items" "i" ON (("i"."id" = "o"."menu_item_id")))
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "i"."business_id")))
  WHERE (("o"."id" = "restaurant_menu_item_option_values"."option_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."restaurant_menu_item_options" "o"
     JOIN "public"."restaurant_menu_items" "i" ON (("i"."id" = "o"."menu_item_id")))
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "i"."business_id")))
  WHERE (("o"."id" = "restaurant_menu_item_option_values"."option_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "restaurant_options_anon_read" ON "public"."restaurant_menu_item_options" FOR SELECT TO "anon" USING (("active" AND (EXISTS ( SELECT 1
   FROM ("public"."restaurant_menu_items" "i"
     JOIN "public"."restaurant_settings" "s" ON (("s"."business_id" = "i"."business_id")))
  WHERE (("i"."id" = "restaurant_menu_item_options"."menu_item_id") AND "i"."active" AND "i"."available" AND "s"."ordering_enabled")))));



CREATE POLICY "restaurant_options_authenticated_read" ON "public"."restaurant_menu_item_options" FOR SELECT TO "authenticated" USING ((("active" AND (EXISTS ( SELECT 1
   FROM ("public"."restaurant_menu_items" "i"
     JOIN "public"."restaurant_settings" "s" ON (("s"."business_id" = "i"."business_id")))
  WHERE (("i"."id" = "restaurant_menu_item_options"."menu_item_id") AND "i"."active" AND "i"."available" AND "s"."ordering_enabled")))) OR (EXISTS ( SELECT 1
   FROM ("public"."restaurant_menu_items" "i"
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "i"."business_id")))
  WHERE (("i"."id" = "restaurant_menu_item_options"."menu_item_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "restaurant_options_supplier_delete" ON "public"."restaurant_menu_item_options" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."restaurant_menu_items" "i"
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "i"."business_id")))
  WHERE (("i"."id" = "restaurant_menu_item_options"."menu_item_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "restaurant_options_supplier_insert" ON "public"."restaurant_menu_item_options" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."restaurant_menu_items" "i"
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "i"."business_id")))
  WHERE (("i"."id" = "restaurant_menu_item_options"."menu_item_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "restaurant_options_supplier_update" ON "public"."restaurant_menu_item_options" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."restaurant_menu_items" "i"
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "i"."business_id")))
  WHERE (("i"."id" = "restaurant_menu_item_options"."menu_item_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."restaurant_menu_items" "i"
     JOIN "public"."supplier_accounts" "sa" ON (("sa"."business_id" = "i"."business_id")))
  WHERE (("i"."id" = "restaurant_menu_item_options"."menu_item_id") AND ("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."restaurant_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurant_settings_supplier_manage" ON "public"."restaurant_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "restaurant_settings"."business_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."supplier_accounts" "sa"
  WHERE (("sa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."business_id" = "restaurant_settings"."business_id")))));



ALTER TABLE "public"."safari_partners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scout_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_appointment_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_appointment_status_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_offerings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_payment_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_payment_idempotency" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_payment_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_payment_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_provider_payout_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_provider_payouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_staff_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_staff_blockouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_staff_claim_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_staff_offerings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_followup_prep_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_onboarding_followup_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_onboarding_followups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_scout_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transfer request participant read" ON "public"."driver_transfer_requests" FOR SELECT TO "authenticated" USING ((("traveler_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."driver_profiles" "d"
  WHERE (("d"."id" = "driver_transfer_requests"."driver_id") AND ("d"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."transfer_booking_pricing_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."travel_refund_review_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."travel_refund_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "travelers can save events" ON "public"."saved_events" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "traveler_id"));



CREATE POLICY "travelers can unsave events" ON "public"."saved_events" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "traveler_id"));



CREATE POLICY "travelers can view their saved events" ON "public"."saved_events" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "traveler_id"));



CREATE POLICY "travelers create eligible transfer requests" ON "public"."driver_transfer_requests" FOR INSERT TO "authenticated" WITH CHECK ((("traveler_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("requested_at" > "now"()) AND (EXISTS ( SELECT 1
   FROM "public"."verification_cases" "vc"
  WHERE (("vc"."subject_type" = 'traveler'::"text") AND ("vc"."subject_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("vc"."status" = 'approved'::"text") AND (("vc"."expires_at" IS NULL) OR ("vc"."expires_at" > "now"()))))) AND (EXISTS ( SELECT 1
   FROM "public"."driver_profiles" "d"
  WHERE (("d"."id" = "driver_transfer_requests"."driver_id") AND ("d"."service_status" = 'active'::"text") AND ("d"."verification_state" = 'verified'::"text") AND ("d"."identity_liveness_verified_at" IS NOT NULL) AND ("d"."personal_photo_url" IS NOT NULL) AND ("d"."driving_license_compliance_status" = ANY (ARRAY['valid'::"text", 'expiring_soon'::"text"]))))) AND (("trip_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "driver_transfer_requests"."trip_id") AND ("t"."traveler_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "travelers create own local requests" ON "public"."local_requests" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "traveler_id") AND (EXISTS ( SELECT 1
   FROM "public"."verification_cases" "vc"
  WHERE (("vc"."subject_type" = 'traveler'::"text") AND ("vc"."subject_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("vc"."status" = 'approved'::"text") AND (("vc"."expires_at" IS NULL) OR ("vc"."expires_at" > "now"()))))) AND (EXISTS ( SELECT 1
   FROM "public"."local_profiles" "p"
  WHERE (("p"."id" = "local_requests"."local_id") AND ("p"."service_status" = 'active'::"text") AND ("p"."verification_state" = 'verified'::"text") AND ("p"."identity_liveness_verified_at" IS NOT NULL)))) AND (("trip_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "local_requests"."trip_id") AND ("t"."traveler_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "travelers read own package checkout attempts" ON "public"."trip_package_checkout_attempts" FOR SELECT TO "authenticated" USING ((("traveler_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_package_checkout_attempts"."trip_id") AND ("t"."traveler_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "travelers read own package payment intents" ON "public"."trip_package_payment_intents" FOR SELECT TO "authenticated" USING ((("traveler_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_package_payment_intents"."trip_id") AND ("t"."traveler_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "travelers read own package quotes" ON "public"."trip_package_quotes" FOR SELECT TO "authenticated" USING ((("traveler_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_package_quotes"."trip_id") AND ("t"."traveler_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."trip_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_package_checkout_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_package_payment_intents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_package_quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verification_cases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verification_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verification_evidence" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."service_appointment_notifications";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































































































































































































































































































































































































































































































































































































































REVOKE ALL ON FUNCTION "public"."activate_supplier_after_review"("p_supplier_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activate_supplier_after_review"("p_supplier_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_driver_verification_state"("p_driver_id" "uuid", "p_state" "text", "p_case_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_driver_verification_state"("p_driver_id" "uuid", "p_state" "text", "p_case_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."service_appointments" TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_service_payment_webhook"("p_appointment_id" "uuid", "p_payment_reference" "text", "p_status" "text", "p_paid_at" timestamp with time zone, "p_refunded_amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_service_payment_webhook"("p_appointment_id" "uuid", "p_payment_reference" "text", "p_status" "text", "p_paid_at" timestamp with time zone, "p_refunded_amount" numeric) TO "service_role";



GRANT ALL ON TABLE "public"."service_provider_payouts" TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_service_provider_payout_result"("payout_id" "uuid", "p_status" "text", "p_reference" "text", "p_conversation_id" "text", "p_result_code" "text", "p_result_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_service_provider_payout_result"("payout_id" "uuid", "p_status" "text", "p_reference" "text", "p_conversation_id" "text", "p_result_code" "text", "p_result_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_service_provider_payout_result"("p_payout_id" "uuid", "p_result_code" integer, "p_result_description" "text", "p_conversation_id" "text", "p_transaction_receipt" "text", "p_succeeded" boolean, "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_service_provider_payout_result"("p_payout_id" "uuid", "p_result_code" integer, "p_result_description" "text", "p_conversation_id" "text", "p_transaction_receipt" "text", "p_succeeded" boolean, "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_service_provider_payout"("p_payout_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_service_provider_payout"("p_payout_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_service_provider_payout_as_admin"("p_payout_id" "uuid", "p_admin_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_service_provider_payout_as_admin"("p_payout_id" "uuid", "p_admin_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."trip_items" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."trip_items" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."attach_service_appointment_to_trip"("p_appointment_id" "uuid", "p_trip_id" "uuid", "p_traveler_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."attach_service_appointment_to_trip"("p_appointment_id" "uuid", "p_trip_id" "uuid", "p_traveler_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."calculate_service_provider_fee"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."calculate_service_provider_fee"() TO "service_role";



GRANT ALL ON TABLE "public"."driver_transfer_requests" TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_driver_transfer_request"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_driver_transfer_request"("p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."capture_travel_refund_review_event"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."capture_travel_refund_review_event"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_next_ai_scout_job"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_next_ai_scout_job"() TO "service_role";



GRANT ALL ON TABLE "public"."supplier_scout_jobs" TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_next_supplier_scout_job"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_next_supplier_scout_job"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_service_provider_payout"("p_payout_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_service_provider_payout"("p_payout_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_concierge_rate_limit"("p_bucket" "text", "p_limit" integer, "p_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_concierge_rate_limit"("p_bucket" "text", "p_limit" integer, "p_window_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_service_appointment"("p_service_profile_id" "uuid", "p_offering_id" "uuid", "p_staff_id" "uuid", "p_customer_user_id" "uuid", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_starts_at" timestamp with time zone, "p_customer_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_service_appointment"("p_service_profile_id" "uuid", "p_offering_id" "uuid", "p_staff_id" "uuid", "p_customer_user_id" "uuid", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_starts_at" timestamp with time zone, "p_customer_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_service_appointment_notifications"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_service_appointment_notifications"() TO "service_role";



GRANT ALL ON TABLE "public"."service_payment_ledger" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_service_payment_ledger_entry"("p_appointment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_service_payment_ledger_entry"("p_appointment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_service_provider_payout_entry"("p_appointment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_service_provider_payout_entry"("p_appointment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_service_provider_payout_for_completed_appointment"("p_appointment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_service_provider_payout_for_completed_appointment"("p_appointment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."detach_service_appointment_from_trip"("p_item_id" "uuid", "p_trip_id" "uuid", "p_traveler_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."detach_service_appointment_from_trip"("p_item_id" "uuid", "p_trip_id" "uuid", "p_traveler_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."driver_assignment_booking_must_exist"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."driver_assignment_booking_must_exist"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."driver_require_activation_compliance"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."driver_require_activation_compliance"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."driver_require_approved_verification"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."driver_require_approved_verification"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."driver_require_vehicle_compliance_for_active"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."driver_require_vehicle_compliance_for_active"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_ai_scout_provider_retry_accounting"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_ai_scout_provider_retry_accounting"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_food_order_payment_lifecycle"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_food_order_payment_lifecycle"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_service_provider_payout_verification"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_service_provider_payout_verification"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_service_provider_terms_before_booking"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_service_provider_terms_before_booking"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."expire_old_events"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_old_events"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_restaurant_refund"("p_refund_id" "uuid", "p_amount" numeric, "p_refund_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_restaurant_refund"("p_refund_id" "uuid", "p_amount" numeric, "p_refund_reference" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_completed_service_provider_payouts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_completed_service_provider_payouts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."hold_service_provider_payout"("p_payout_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hold_service_provider_payout"("p_payout_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."invoke_ai_scout_worker"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invoke_ai_scout_worker"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."invoke_supplier_scout_worker"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invoke_supplier_scout_worker"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."lease_ai_scout_running_jobs"("p_limit" integer, "p_lease_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lease_ai_scout_running_jobs"("p_limit" integer, "p_lease_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."local_require_approved_verification"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."local_require_approved_verification"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_expired_events"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_expired_events"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_service_provider_payout_eligible"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_service_provider_payout_eligible"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prepare_service_provider_payout"("payout_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prepare_service_provider_payout"("payout_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_food_order_payment_state"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_food_order_payment_state"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_trip_item_service_appointment_mutation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_trip_item_service_appointment_mutation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reconcile_service_provider_payouts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reconcile_service_provider_payouts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_driver_compliance"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_driver_compliance"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."release_ai_scout_lease"("p_owner" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_ai_scout_lease"("p_owner" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reorder_trip_items"("p_trip_id" "uuid", "p_traveler_id" "uuid", "p_item_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_trip_items"("p_trip_id" "uuid", "p_traveler_id" "uuid", "p_item_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."requeue_stale_ai_scout_jobs"("p_stale_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."requeue_stale_ai_scout_jobs"("p_stale_minutes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."requeue_transient_ai_scout_failures"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."requeue_transient_ai_scout_failures"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reschedule_service_appointment"("p_appointment_id" "uuid", "p_customer_user_id" "uuid", "p_starts_at" timestamp with time zone, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reschedule_service_appointment"("p_appointment_id" "uuid", "p_customer_user_id" "uuid", "p_starts_at" timestamp with time zone, "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."respond_to_driver_transfer_request"("p_request_id" "uuid", "p_decision" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."respond_to_driver_transfer_request"("p_request_id" "uuid", "p_decision" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sanitize_ai_discovered_event_image"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sanitize_ai_discovered_event_image"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."service_appointment_require_verified_traveler"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."service_appointment_require_verified_traveler"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."service_provider_verification_ready"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."service_provider_verification_ready"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."service_staff_require_external_verification"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."service_staff_require_external_verification"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_activity_booking_pricing_ledger_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_activity_booking_pricing_ledger_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_hotel_booking_pricing_ledger_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_hotel_booking_pricing_ledger_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_hotelbeds_content_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_hotelbeds_content_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_restaurant_food_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_restaurant_food_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_service_provider_payout_status"("p_payout_id" "uuid", "p_status" "text", "p_provider" "text", "p_reference" "text", "p_failure_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_service_provider_payout_status"("p_payout_id" "uuid", "p_status" "text", "p_provider" "text", "p_reference" "text", "p_failure_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_supplier_completion_on_account"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_supplier_completion_on_account"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_transfer_booking_pricing_ledger_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_transfer_booking_pricing_ledger_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_supplier_for_review"("p_supplier_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_supplier_for_review"("p_supplier_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."supplier_completion"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."supplier_completion"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_food_order_delivery_assignment"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_food_order_delivery_assignment"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_hotel_trip_item_ledger_reference"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_hotel_trip_item_ledger_reference"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_service_appointment_journey_times"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_service_appointment_journey_times"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_service_payment_ledger"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_service_payment_ledger"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_service_provider_payout"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_service_provider_payout"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_supplier_completion_from_business"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_supplier_completion_from_business"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_supplier_completion_from_service_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_supplier_completion_from_service_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."transition_service_appointment_status"("p_appointment_id" "uuid", "p_to_status" "text", "p_actor_type" "text", "p_actor_user_id" "uuid", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_service_appointment_status"("p_appointment_id" "uuid", "p_to_status" "text", "p_actor_type" "text", "p_actor_user_id" "uuid", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."travel_os_lock_user_booking"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."travel_os_lock_user_booking"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."travel_os_log_booking_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."travel_os_log_booking_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."travel_os_require_approved_event"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."travel_os_require_approved_event"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."travel_os_require_approved_offering"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."travel_os_require_approved_offering"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."try_acquire_ai_scout_lease"("p_owner" "text", "p_lease_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."try_acquire_ai_scout_lease"("p_owner" "text", "p_lease_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_events_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_events_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_food_order_item_amounts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_food_order_item_amounts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_restaurant_menu_item_category"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_restaurant_menu_item_category"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_service_appointment_time_window"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_service_appointment_time_window"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."verification_events_immutable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verification_events_immutable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_ai_scout_worker_token"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_ai_scout_worker_token"("p_token" "text") TO "service_role";
























GRANT ALL ON TABLE "public"."activity_booking_pricing_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."admin_telemetry_logs" TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "service_role";
GRANT SELECT ON TABLE "public"."admin_users" TO "authenticated";



GRANT ALL ON TABLE "public"."ai_discovered_events" TO "service_role";
GRANT SELECT ON TABLE "public"."ai_discovered_events" TO "authenticated";



GRANT ALL ON TABLE "public"."ai_event_itineraries" TO "service_role";



GRANT ALL ON TABLE "public"."ai_sales_outreach" TO "service_role";



GRANT ALL ON TABLE "public"."ai_sales_prospects" TO "service_role";



GRANT ALL ON TABLE "public"."ai_scans" TO "service_role";



GRANT ALL ON TABLE "public"."ai_scout_locks" TO "service_role";



GRANT ALL ON TABLE "public"."ai_scout_runs" TO "service_role";
GRANT SELECT ON TABLE "public"."ai_scout_runs" TO "authenticated";



GRANT ALL ON TABLE "public"."aurelian_feed_runs" TO "service_role";



GRANT ALL ON TABLE "public"."booking_status_events" TO "service_role";
GRANT SELECT ON TABLE "public"."booking_status_events" TO "authenticated";



GRANT ALL ON TABLE "public"."bookings" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."bookings" TO "authenticated";



GRANT ALL ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cities" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON TABLE "public"."concierge_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."crm_activities" TO "service_role";



GRANT ALL ON TABLE "public"."crm_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."crm_conversions" TO "service_role";



GRANT ALL ON TABLE "public"."crm_followups" TO "service_role";



GRANT ALL ON TABLE "public"."discoveries" TO "service_role";



GRANT ALL ON TABLE "public"."driver_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."driver_availability" TO "service_role";



GRANT ALL ON TABLE "public"."driver_compliance_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."driver_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."driver_compliance_overview" TO "service_role";



GRANT ALL ON TABLE "public"."driver_transfer_rates" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."food_delivery_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."food_order_item_options" TO "service_role";



GRANT ALL ON TABLE "public"."food_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."food_order_payment_idempotency" TO "service_role";



GRANT ALL ON TABLE "public"."food_order_refunds" TO "service_role";



GRANT ALL ON TABLE "public"."food_orders" TO "service_role";



GRANT ALL ON TABLE "public"."hotel_booking_pricing_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."hotel_checkout_intents" TO "service_role";



GRANT ALL ON TABLE "public"."hotelbeds_content_sync_state" TO "service_role";



GRANT ALL ON TABLE "public"."hotelbeds_hotel_content" TO "service_role";



GRANT ALL ON TABLE "public"."integration_syncs" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_kinds" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_kinds" TO "anon";
GRANT SELECT ON TABLE "public"."inventory_kinds" TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."journal_articles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."journal_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_articles" TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON TABLE "public"."local_availability" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."local_availability" TO "authenticated";
GRANT SELECT ON TABLE "public"."local_availability" TO "anon";



GRANT ALL ON TABLE "public"."local_profiles" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."local_profiles" TO "authenticated";
GRANT SELECT ON TABLE "public"."local_profiles" TO "anon";



GRANT ALL ON TABLE "public"."local_requests" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."local_requests" TO "authenticated";



GRANT ALL ON TABLE "public"."marketing_drafts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."marketing_drafts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."marketing_drafts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."marketing_drafts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."offerings" TO "service_role";
GRANT SELECT ON TABLE "public"."offerings" TO "authenticated";



GRANT ALL ON TABLE "public"."partner_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."price_quotes" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."promotions" TO "service_role";



GRANT ALL ON TABLE "public"."providers" TO "service_role";
GRANT SELECT ON TABLE "public"."providers" TO "authenticated";



GRANT ALL ON TABLE "public"."push_notification_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_menu_categories" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_menu_item_option_values" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_menu_item_options" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_settings" TO "service_role";



GRANT ALL ON TABLE "public"."safari_partners" TO "service_role";



GRANT ALL ON TABLE "public"."saved_events" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_events" TO "service_role";



GRANT ALL ON TABLE "public"."scout_runs" TO "service_role";



GRANT ALL ON TABLE "public"."service_appointment_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."service_appointment_status_events" TO "service_role";



GRANT ALL ON TABLE "public"."service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."service_offerings" TO "service_role";



GRANT ALL ON TABLE "public"."service_payment_events" TO "service_role";



GRANT ALL ON TABLE "public"."service_payment_idempotency" TO "service_role";



GRANT ALL ON TABLE "public"."service_payment_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."service_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."service_provider_payout_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."service_staff" TO "service_role";



GRANT ALL ON TABLE "public"."service_staff_availability" TO "service_role";



GRANT ALL ON TABLE "public"."service_staff_blockouts" TO "service_role";



GRANT ALL ON TABLE "public"."service_staff_claim_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."service_staff_offerings" TO "service_role";



GRANT ALL ON TABLE "public"."sources" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_followup_prep_runs" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_onboarding_followup_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_onboarding_followups" TO "service_role";



GRANT ALL ON TABLE "public"."transfer_booking_pricing_ledger" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."travel_refund_review_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."travel_refund_review_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."travel_refund_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."trip_package_checkout_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."trip_package_payment_intents" TO "service_role";



GRANT ALL ON TABLE "public"."trip_package_quotes" TO "service_role";



GRANT ALL ON TABLE "public"."trips" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."trips" TO "authenticated";



GRANT ALL ON TABLE "public"."verification_cases" TO "service_role";



GRANT ALL ON TABLE "public"."verification_events" TO "service_role";



GRANT ALL ON TABLE "public"."verification_evidence" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































