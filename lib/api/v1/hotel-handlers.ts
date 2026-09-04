import { liveHotelAdapters } from "@/lib/integrations/hotels/registry";
import {
  hotelAvailability,
  hotelQuote,
  parseHotelSearchRequest,
  searchHotels,
} from "@/lib/services/hotels";
import { jsonError, jsonOk } from "./http";
import { ParamError } from "./params";

export function hotelInventoryNotConfigured(): Response {
  return jsonError(
    503,
    "hotel_inventory_not_configured",
    "Hotel inventory is not configured. No live hotel supplier is connected."
  );
}

function fromHotelError(code: string, message: string): Response {
  if (code === "not_configured" || code === "contract_required") {
    return hotelInventoryNotConfigured();
  }
  if (code === "bad_request") return jsonError(400, "bad_request", message);
  if (code === "timeout") return jsonError(503, "unavailable", message);
  return jsonError(503, "unavailable", message);
}

function requireLiveInventory(): Response | null {
  if (liveHotelAdapters().length === 0) return hotelInventoryNotConfigured();
  return null;
}

export async function handleHotelSearch(request: Request): Promise<Response> {
  const blocked = requireLiveInventory();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const query = parseHotelSearchRequest({
      destination: url.searchParams.get("destination") ?? undefined,
      check_in: url.searchParams.get("check_in") ?? undefined,
      check_out: url.searchParams.get("check_out") ?? undefined,
      guests: url.searchParams.get("guests") ?? undefined,
      rooms: url.searchParams.get("rooms") ?? undefined,
      currency: url.searchParams.get("currency") ?? undefined,
    });
    const result = await searchHotels(query);
    if (!result.ok) return fromHotelError(result.error.code, result.error.message);
    return jsonOk(result.data.results, {
      meta: {
        inventory: "supplier",
        providers: liveHotelAdapters().length,
        total: result.data.results.length,
      },
    });
  } catch (error) {
    return jsonError(
      400,
      "bad_request",
      error instanceof Error ? error.message : "Invalid hotel search."
    );
  }
}

export async function handleHotelAvailability(request: Request): Promise<Response> {
  const blocked = requireLiveInventory();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const property_id = url.searchParams.get("property_id")?.trim() || "";
    if (!property_id) {
      throw new ParamError("property_id is required.");
    }
    const query = parseHotelSearchRequest({
      destination: url.searchParams.get("destination") ?? undefined,
      check_in: url.searchParams.get("check_in") ?? undefined,
      check_out: url.searchParams.get("check_out") ?? undefined,
      guests: url.searchParams.get("guests") ?? undefined,
      rooms: url.searchParams.get("rooms") ?? undefined,
      currency: url.searchParams.get("currency") ?? undefined,
    });
    const result = await hotelAvailability({ ...query, property_id });
    if (!result.ok) return fromHotelError(result.error.code, result.error.message);
    return jsonOk(result.data);
  } catch (error) {
    return jsonError(
      400,
      "bad_request",
      error instanceof Error ? error.message : "Invalid availability request."
    );
  }
}

export async function handleHotelQuote(request: Request): Promise<Response> {
  const blocked = requireLiveInventory();
  if (blocked) return blocked;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const result = await hotelQuote({
    provider: "direct",
    property_id: String(body.property_id || ""),
    room_id: String(body.room_id || ""),
    rate_id: typeof body.rate_id === "string" ? body.rate_id : null,
    check_in: String(body.check_in || ""),
    check_out: String(body.check_out || ""),
    guests: Number(body.guests || 1),
    rooms: Number(body.rooms || 1),
    currency: typeof body.currency === "string" ? body.currency : undefined,
    supplier_amount: Number(body.supplier_amount),
    supplier_currency: String(body.supplier_currency || ""),
  });
  if (!result.ok) return fromHotelError(result.error.code, result.error.message);
  return jsonOk(result.data);
}
