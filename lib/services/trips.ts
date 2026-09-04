import type { SupabaseClient } from "@supabase/supabase-js";
import { getApprovedEvent } from "@/lib/api/v1/catalog";
import { paginationRange } from "@/lib/api/v1/params";

export type UserClient = Pick<SupabaseClient, "from">;

export type TripRecord = {
  id: string;
  traveler_id: string;
  title: string | null;
  destination_city_id: string | null;
  start_on: string | null;
  end_on: string | null;
  status: string;
  created_at: string;
};

export async function listTrips(
  client: UserClient,
  travelerId: string,
  page: number,
  limit: number
) {
  const { from, to } = paginationRange(page, limit);
  const { data, error, count } = await client
    .from("trips")
    .select(
      "id, traveler_id, title, destination_city_id, start_on, end_on, status, created_at",
      { count: "exact" }
    )
    .eq("traveler_id", travelerId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) {
    console.error("trips.list", error.message);
    return { ok: false as const, reason: "db" as const };
  }
  return {
    ok: true as const,
    data: (data ?? []) as TripRecord[],
    count: count ?? data?.length ?? 0,
  };
}

export async function createTrip(
  client: UserClient,
  input: {
    travelerId: string;
    title?: string;
    destinationCityId?: string;
    startOn?: string;
    endOn?: string;
  }
) {
  const { data, error } = await client
    .from("trips")
    .insert({
      traveler_id: input.travelerId,
      title: input.title || null,
      destination_city_id: input.destinationCityId || null,
      start_on: input.startOn || null,
      end_on: input.endOn || null,
      status: "draft",
    })
    .select(
      "id, traveler_id, title, destination_city_id, start_on, end_on, status, created_at"
    )
    .single();
  if (error) {
    console.error("trips.create", error.message);
    return { ok: false as const, reason: "db" as const };
  }
  return { ok: true as const, data: data as TripRecord };
}

export async function addTripEventItem(
  client: UserClient,
  input: { travelerId: string; tripId: string; eventId: string }
) {
  const { data: trip, error: tripError } = await client
    .from("trips")
    .select("id, traveler_id")
    .eq("id", input.tripId)
    .eq("traveler_id", input.travelerId)
    .maybeSingle();
  if (tripError) {
    console.error("trips.item.trip", tripError.message);
    return { ok: false as const, reason: "db" as const };
  }
  if (!trip) return { ok: false as const, reason: "not_found" as const };

  const event = await getApprovedEvent(client, input.eventId);
  if (!event.ok) return { ok: false as const, reason: "not_found" as const };

  const { count } = await client
    .from("trip_items")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", input.tripId);

  const { data, error } = await client
    .from("trip_items")
    .insert({
      trip_id: input.tripId,
      event_id: input.eventId,
      item_kind: "event",
      booking_id: null,
      position: count ?? 0,
    })
    .select("id, trip_id, event_id, item_kind, position")
    .single();
  if (error) {
    if (error.code === "23505" || /duplicate key/i.test(error.message)) {
      return { ok: false as const, reason: "conflict" as const };
    }
    console.error("trips.item.insert", error.message);
    return { ok: false as const, reason: "db" as const };
  }
  return { ok: true as const, data };
}
