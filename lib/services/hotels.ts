import { liveHotelAdapters } from "@/lib/integrations/hotels/registry";
import { hotelError } from "@/lib/integrations/hotels/errors";
import type {
  HotelAvailabilityRequest,
  HotelAvailabilityResponse,
  HotelConfirmRequest,
  HotelHoldRequest,
  HotelQuoteRequest,
  HotelQuoteResponse,
  HotelResult,
  HotelSearchRequest,
  HotelSearchResult,
} from "@/lib/integrations/hotels/types";
import { prepareQuote } from "./pricing";

export const HOTEL_INVENTORY_UNAVAILABLE_MESSAGE =
  "Hotel inventory is not configured. No live hotel supplier is connected.";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseHotelSearchRequest(
  input: Record<string, string | undefined>
): HotelSearchRequest {
  const destination = (input.destination || "").trim();
  if (!destination) throw new Error("destination is required.");
  if (destination.length > 80) throw new Error("destination is too long.");

  const check_in = (input.check_in || "").trim();
  const check_out = (input.check_out || "").trim();
  if (!DATE_RE.test(check_in) || !DATE_RE.test(check_out)) {
    throw new Error("check_in and check_out must be YYYY-MM-DD.");
  }
  if (check_out <= check_in) {
    throw new Error("check_out must be after check_in.");
  }

  const guests = Number(input.guests || "1");
  const rooms = Number(input.rooms || "1");
  if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
    throw new Error("guests must be an integer between 1 and 20.");
  }
  if (!Number.isInteger(rooms) || rooms < 1 || rooms > 10) {
    throw new Error("rooms must be an integer between 1 and 10.");
  }

  const currency = input.currency?.trim().toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("currency must be a 3-letter code.");
  }

  return { destination, check_in, check_out, guests, rooms, currency };
}

export function mapSupplierQuote(request: HotelQuoteRequest): HotelQuoteResponse {
  if (request.currency && request.currency !== request.supplier_currency) {
    throw new Error(
      "Live exchange rates are not configured. Customer currency must match supplier currency."
    );
  }
  const quote = prepareQuote({
    supplierAmount: request.supplier_amount,
    supplierCurrency: request.supplier_currency,
    markupAmount: request.markup_amount,
    commissionAmount: request.commission_amount,
    taxAmount: request.tax_amount,
    feeAmount: request.fee_amount,
    customerCurrency: request.supplier_currency,
    source: "supplier",
  });
  return {
    provider: request.provider,
    property_id: request.property_id,
    room_id: request.room_id,
    rate_id: request.rate_id,
    quote,
  };
}

export async function searchHotels(
  request: HotelSearchRequest
): Promise<HotelResult<{ results: HotelSearchResult[] }>> {
  const live = liveHotelAdapters();
  if (live.length === 0) {
    return {
      ok: false,
      error: hotelError(
        "not_configured",
        HOTEL_INVENTORY_UNAVAILABLE_MESSAGE,
        false
      ),
    };
  }
  const collected: HotelSearchResult[] = [];
  for (const adapter of live) {
    if (!adapter.capabilities().search) continue;
    const result = await adapter.search(request);
    if (result.ok) collected.push(...result.data.results);
  }
  return { ok: true, data: { results: collected } };
}

export async function hotelAvailability(
  request: HotelAvailabilityRequest
): Promise<HotelResult<HotelAvailabilityResponse>> {
  const live = liveHotelAdapters();
  if (live.length === 0) {
    return {
      ok: false,
      error: hotelError(
        "not_configured",
        HOTEL_INVENTORY_UNAVAILABLE_MESSAGE,
        false
      ),
    };
  }
  const adapter = live[0];
  if (!adapter.capabilities().availability) {
    return {
      ok: false,
      error: hotelError(
        "capability_unsupported",
        "No live provider supports availability.",
        false
      ),
    };
  }
  return adapter.availability(request);
}

export async function hotelQuote(
  request: HotelQuoteRequest
): Promise<HotelResult<HotelQuoteResponse>> {
  const live = liveHotelAdapters();
  if (live.length === 0) {
    return {
      ok: false,
      error: hotelError(
        "not_configured",
        HOTEL_INVENTORY_UNAVAILABLE_MESSAGE,
        false
      ),
    };
  }
  return live[0].quote(request);
}

export async function hotelHold(request: HotelHoldRequest) {
  const live = liveHotelAdapters();
  if (live.length === 0) {
    return {
      ok: false as const,
      error: hotelError("contract_required", HOTEL_INVENTORY_UNAVAILABLE_MESSAGE),
    };
  }
  if (!request.idempotency_key.trim()) {
    return {
      ok: false as const,
      error: hotelError("bad_request", "idempotency_key is required for hold."),
    };
  }
  return live[0].hold(request);
}

export async function hotelConfirm(request: HotelConfirmRequest) {
  void request;
  return {
    ok: false as const,
    error: hotelError(
      "contract_required",
      "Hotel booking confirmation is disabled until a live supplier contract exists.",
      false
    ),
  };
}
