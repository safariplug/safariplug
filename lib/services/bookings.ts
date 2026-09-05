import type { SupabaseClient } from "@supabase/supabase-js";
import { getApprovedEvent } from "@/lib/api/v1/catalog";
import { paginationRange } from "@/lib/api/v1/params";
import { listedEventQuote } from "./pricing";

export type UserClient = Pick<SupabaseClient, "from">;

export const BOOKING_STATUSES = [
  "search",
  "availability",
  "quote",
  "hold",
  "confirmed",
  "booked",
  "modified",
  "cancelled",
  "completed",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

function publicId(): string {
  return `spb_${crypto.randomUUID().replace(/-/g, "")}`;
}

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}

export async function listBookings(
  client: UserClient,
  travelerId: string,
  page: number,
  limit: number
) {
  const { from, to } = paginationRange(page, limit);
  const { data, error, count } = await client
    .from("bookings")
    .select(
      "id, public_id, traveler_id, trip_id, offering_id, event_id, provider_id, status, supplier_amount, supplier_currency, customer_total, customer_currency, price_source, expires_at, created_at",
      { count: "exact" }
    )
    .eq("traveler_id", travelerId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) {
    console.error("bookings.list", error.message);
    return { ok: false as const, reason: "db" as const };
  }
  return { ok: true as const, data: data ?? [], count: count ?? data?.length ?? 0 };
}

export async function createQuoteBooking(
  client: UserClient,
  input: {
    travelerId: string;
    eventId: string;
    tripId?: string;
    idempotencyKey?: string;
  }
) {
  const event = await getApprovedEvent(client, input.eventId);
  if (!event.ok && event.reason === "db") {
    return { ok: false as const, reason: "db" as const };
  }
  if (!event.ok) return { ok: false as const, reason: "not_found" as const };

  if (input.tripId) {
    const { data: trip, error: tripError } = await client
      .from("trips")
      .select("id")
      .eq("id", input.tripId)
      .eq("traveler_id", input.travelerId)
      .maybeSingle();
    if (tripError) {
      console.error("bookings.trip", tripError.message);
      return { ok: false as const, reason: "db" as const };
    }
    if (!trip) return { ok: false as const, reason: "not_found" as const };
  }

  if (input.idempotencyKey) {
    const { data: existing } = await client
      .from("bookings")
      .select(
        "id, public_id, traveler_id, trip_id, event_id, status, supplier_amount, supplier_currency, customer_total, customer_currency, price_source, expires_at, created_at"
      )
      .eq("idempotency_key", input.idempotencyKey)
      .eq("traveler_id", input.travelerId)
      .maybeSingle();
    if (existing) return { ok: true as const, data: existing, reused: true };
  }

  const quote = listedEventQuote(event.data.price, event.data.currency);

  const { data, error } = await client
    .from("bookings")
    .insert({
      public_id: publicId(),
      traveler_id: input.travelerId,
      trip_id: input.tripId || null,
      event_id: input.eventId,
      status: "quote",
      idempotency_key: input.idempotencyKey || null,
      supplier_amount: quote?.supplier_amount ?? null,
      supplier_currency: quote?.supplier_currency ?? null,
      markup_amount: 0,
      commission_amount: 0,
      discount_amount: 0,
      tax_amount: 0,
      fee_amount: 0,
      customer_total: quote?.customer_total ?? null,
      customer_currency: quote?.customer_currency ?? null,
      price_source: quote?.source ?? "unconfirmed_listed",
      supplier_reference: null,
      notes: "Listed event price only. Not supplier-confirmed.",
    })
    .select(
      "id, public_id, traveler_id, trip_id, event_id, status, supplier_amount, supplier_currency, customer_total, customer_currency, price_source, expires_at, created_at"
    )
    .single();
  if (error) {
    if (isUniqueViolation(error) && input.idempotencyKey) {
      return { ok: false as const, reason: "conflict" as const };
    }
    console.error("bookings.create", error.message);
    return { ok: false as const, reason: "db" as const };
  }

  return { ok: true as const, data, reused: false };
}

export function providerBookingUnavailableMessage(): string {
  return "Provider booking is not available. No live booking contract is configured.";
}
