import { getSupabaseAnonClient } from "@/lib/supabase-anon";
import {
  getRequestUser,
  getSupabaseUserClient,
} from "@/lib/supabase-user";
import { lookupAvailability } from "@/lib/services/availability";
import {
  createQuoteBooking,
  listBookings,
  providerBookingUnavailableMessage,
} from "@/lib/services/bookings";
import {
  listApprovedOfferings,
  SERVICE_KINDS,
  TRANSFER_KINDS,
} from "@/lib/services/offerings";
import { listActiveProviders, getActiveProvider } from "@/lib/services/providers";
import { addTripEventItem, createTrip, listTrips } from "@/lib/services/trips";
import {
  catalogUnavailable,
  configurationUnavailable,
  jsonError,
  conflict,
  jsonOk,
  unauthorized,
  unavailable,
} from "./http";
import {
  isUuid,
  ParamError,
  parseBoundedText,
  parseLimit,
  parsePage,
} from "./params";

function emptyInventoryMeta() {
  return {
    inventory: "none" as const,
    note: "No live provider inventory is loaded. Public catalog remains /api/v1/events.",
  };
}

export async function handleListProviders(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const page = parsePage(url.searchParams.get("page"));
    const limit = parseLimit(url.searchParams.get("limit"));
    const type = parseBoundedText(url.searchParams.get("type"), "type");
    const client = getSupabaseAnonClient();
    if (!client) return configurationUnavailable();
    const result = await listActiveProviders(client, { page, limit, type });
    if (!result.ok) return catalogUnavailable();
    return jsonOk(result.data, {
      meta: { page, limit, total: result.count, ...emptyInventoryMeta() },
    });
  } catch (error) {
    if (error instanceof ParamError) {
      return jsonError(400, "bad_request", error.message);
    }
    return catalogUnavailable();
  }
}

export async function handleGetProvider(id: string): Promise<Response> {
  if (!isUuid(id)) return jsonError(400, "bad_request", "id must be a UUID.");
  const client = getSupabaseAnonClient();
  if (!client) return configurationUnavailable();
  const result = await getActiveProvider(client, id);
  if (!result.ok && result.reason === "db") return catalogUnavailable();
  if (!result.ok) return jsonError(404, "not_found", "Provider not found.");
  return jsonOk(result.data);
}

export async function handleListServices(request: Request): Promise<Response> {
  return listKindCollection(request, SERVICE_KINDS, "services");
}

export async function handleListTransfers(request: Request): Promise<Response> {
  return listKindCollection(request, TRANSFER_KINDS, "transfers");
}

async function listKindCollection(
  request: Request,
  kinds: readonly string[],
  collection: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const page = parsePage(url.searchParams.get("page"));
    const limit = parseLimit(url.searchParams.get("limit"));
    const client = getSupabaseAnonClient();
    if (!client) return configurationUnavailable();
    const result = await listApprovedOfferings(client, { page, limit, kinds });
    if (!result.ok) return catalogUnavailable();
    return jsonOk(result.data, {
      meta: {
        page,
        limit,
        total: result.count,
        collection,
        kinds,
        ...emptyInventoryMeta(),
      },
    });
  } catch (error) {
    if (error instanceof ParamError) {
      return jsonError(400, "bad_request", error.message);
    }
    return catalogUnavailable();
  }
}

async function requireUser(request: Request) {
  const ready = getSupabaseUserClient(request);
  if (!ready.ok && ready.reason === "config") {
    return { ok: false as const, response: configurationUnavailable() };
  }
  if (!ready.ok) {
    return { ok: false as const, response: unauthorized() };
  }
  const user = await getRequestUser(ready.client);
  if (!user) return { ok: false as const, response: unauthorized() };
  return { ok: true as const, client: ready.client, user };
}

export async function handleListTrips(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const page = parsePage(url.searchParams.get("page"));
    const limit = parseLimit(url.searchParams.get("limit"));
    const result = await listTrips(auth.client, auth.user.id, page, limit);
    if (!result.ok) return catalogUnavailable();
    return jsonOk(result.data, { meta: { page, limit, total: result.count } });
  } catch (error) {
    if (error instanceof ParamError) {
      return jsonError(400, "bad_request", error.message);
    }
    return catalogUnavailable();
  }
}

export async function handleCreateTrip(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 120) : undefined;
  const destinationCityId =
    typeof body.destination_city_id === "string" && isUuid(body.destination_city_id)
      ? body.destination_city_id
      : undefined;
  const startOn =
    typeof body.start_on === "string" ? body.start_on : undefined;
  const endOn = typeof body.end_on === "string" ? body.end_on : undefined;
  const result = await createTrip(auth.client, {
    travelerId: auth.user.id,
    title,
    destinationCityId,
    startOn,
    endOn,
  });
  if (!result.ok) return catalogUnavailable();
  return jsonOk(result.data, { status: 201 });
}

export async function handleAddTripItem(
  request: Request,
  tripId: string
): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!isUuid(tripId)) return jsonError(400, "bad_request", "id must be a UUID.");
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "bad_request", "JSON body is required.");
  }
  const eventId = typeof body.event_id === "string" ? body.event_id : "";
  if (!isUuid(eventId)) {
    return jsonError(400, "bad_request", "event_id must be a UUID of an approved event.");
  }
  const result = await addTripEventItem(auth.client, {
    travelerId: auth.user.id,
    tripId,
    eventId,
  });
  if (!result.ok && result.reason === "not_found") {
    return jsonError(404, "not_found", "Trip or approved event not found.");
  }
  if (!result.ok && result.reason === "conflict") {
    return conflict("Event is already on this trip.");
  }
  if (!result.ok) return catalogUnavailable();
  return jsonOk(result.data, { status: 201 });
}

export async function handleListBookings(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const page = parsePage(url.searchParams.get("page"));
    const limit = parseLimit(url.searchParams.get("limit"));
    const result = await listBookings(auth.client, auth.user.id, page, limit);
    if (!result.ok) return catalogUnavailable();
    return jsonOk(result.data, { meta: { page, limit, total: result.count } });
  } catch (error) {
    if (error instanceof ParamError) {
      return jsonError(400, "bad_request", error.message);
    }
    return catalogUnavailable();
  }
}

export async function handleCreateBooking(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const eventId =
    typeof body.event_id === "string" && isUuid(body.event_id)
      ? body.event_id
      : "";
  if (!eventId) {
    return jsonError(
      400,
      "bad_request",
      "event_id is required and must be an approved event UUID."
    );
  }
  const tripId =
    typeof body.trip_id === "string" && isUuid(body.trip_id)
      ? body.trip_id
      : undefined;
  const idempotencyKey =
    typeof body.idempotency_key === "string"
      ? body.idempotency_key.trim().slice(0, 80) || undefined
      : undefined;
  try {
    const result = await createQuoteBooking(auth.client, {
      travelerId: auth.user.id,
      eventId,
      tripId,
      idempotencyKey,
    });
    if (!result.ok && result.reason === "not_found") {
      return jsonError(404, "not_found", "Approved event or trip not found.");
    }
    if (!result.ok && result.reason === "conflict") {
      return conflict("Idempotency key already used.");
    }
    if (!result.ok) return catalogUnavailable();
    return jsonOk(result.data, { status: result.reused ? 200 : 201 });
  } catch (error) {
    return jsonError(
      400,
      "bad_request",
      error instanceof Error ? error.message : "Invalid quote."
    );
  }
}

export async function handleConfirmBooking(): Promise<Response> {
  return unavailable(providerBookingUnavailableMessage());
}

export async function handleAvailability(): Promise<Response> {
  const result = lookupAvailability();
  return unavailable(result.reason);
}
