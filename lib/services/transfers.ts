import { liveTransferAdapters } from "@/lib/integrations/transfers/registry";
import { transferError } from "@/lib/integrations/transfers/errors";
import type {
  TransferAvailabilityRequest,
  TransferConfirmRequest,
  TransferHoldRequest,
  TransferLocation,
  TransferLocationKind,
  TransferQuoteRequest,
  TransferQuoteResponse,
  TransferResult,
  TransferSearchRequest,
  TransferSearchResult,
  TransferTripType,
} from "@/lib/integrations/transfers/types";
import { prepareQuote } from "./pricing";

export const TRANSFER_INVENTORY_UNAVAILABLE_MESSAGE =
  "Transfer inventory is not configured. No live transfer supplier is connected.";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const LOCATION_KINDS: TransferLocationKind[] = [
  "airport",
  "hotel",
  "attraction",
  "address",
  "city",
  "coordinates",
];

function parseCount(raw: string | undefined, field: string, fallback: number, max: number) {
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new Error(`${field} must be an integer between 0 and ${max}.`);
  }
  return value;
}

export function parseTransferLocation(
  prefix: "pickup" | "dropoff",
  input: Record<string, string | undefined>
): TransferLocation {
  const kindRaw = (input[`${prefix}_kind`] || "city").trim() as TransferLocationKind;
  if (!LOCATION_KINDS.includes(kindRaw)) {
    throw new Error(`${prefix}_kind is invalid.`);
  }
  const name = input[prefix]?.trim() || input[`${prefix}_name`]?.trim();
  const city = input[`${prefix}_city`]?.trim() || (kindRaw === "city" ? name : undefined);
  const location: TransferLocation = { kind: kindRaw };
  if (name) location.name = name;
  if (city) location.city = city;
  const place = input[`${prefix}_place_id`]?.trim();
  if (place) location.place_id = place;
  const airport = input[`${prefix}_airport`]?.trim();
  if (airport) location.airport_code = airport;
  const hotel = input[`${prefix}_hotel`]?.trim();
  if (hotel) location.hotel_property_id = hotel;
  const address = input[`${prefix}_address`]?.trim();
  if (address) location.address = address;
  const lat = input[`${prefix}_lat`]?.trim();
  const lng = input[`${prefix}_lng`]?.trim();
  if (lat) {
    const value = Number(lat);
    if (!Number.isFinite(value)) throw new Error(`${prefix}_lat is invalid.`);
    location.latitude = value;
  }
  if (lng) {
    const value = Number(lng);
    if (!Number.isFinite(value)) throw new Error(`${prefix}_lng is invalid.`);
    location.longitude = value;
  }
  if (!location.name && !location.city && !location.airport_code && !location.address && !location.place_id) {
    throw new Error(`${prefix} location is required.`);
  }
  return location;
}

export function parseTransferSearchRequest(
  input: Record<string, string | undefined>
): TransferSearchRequest {
  const pickup = parseTransferLocation("pickup", input);
  const dropoff = parseTransferLocation("dropoff", input);
  const pickup_date = (input.pickup_date || "").trim();
  if (!DATE_RE.test(pickup_date)) throw new Error("pickup_date must be YYYY-MM-DD.");
  const pickup_time = input.pickup_time?.trim();
  if (pickup_time && !TIME_RE.test(pickup_time)) {
    throw new Error("pickup_time must be HH:MM.");
  }
  const tripRaw = (input.trip_type || "one_way").trim() as TransferTripType;
  if (tripRaw !== "one_way" && tripRaw !== "round_trip") {
    throw new Error("trip_type must be one_way or round_trip.");
  }
  const currency = input.currency?.trim().toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("currency must be a 3-letter code.");
  }
  return {
    pickup,
    dropoff,
    pickup_date,
    pickup_time,
    timezone: input.timezone?.trim() || "Africa/Nairobi",
    adults: Math.max(1, parseCount(input.adults || input.passengers, "adults", 1, 20)),
    children: parseCount(input.children, "children", 0, 20),
    infants: parseCount(input.infants, "infants", 0, 10),
    luggage: parseCount(input.luggage, "luggage", 0, 20),
    trip_type: tripRaw,
    vehicle_category: input.vehicle_category?.trim(),
    currency,
  };
}

export function mapSupplierTransferQuote(
  request: TransferQuoteRequest
): TransferQuoteResponse {
  if (request.currency && request.currency !== request.supplier_currency) {
    throw new Error(
      "Live exchange rates are not configured. Customer currency must match supplier currency."
    );
  }
  return {
    provider: request.provider,
    transfer_id: request.transfer_id,
    quote: prepareQuote({
      supplierAmount: request.supplier_amount,
      supplierCurrency: request.supplier_currency,
      markupAmount: request.markup_amount,
      commissionAmount: request.commission_amount,
      taxAmount: request.tax_amount,
      feeAmount: request.fee_amount,
      customerCurrency: request.supplier_currency,
      source: "supplier",
    }),
  };
}

export async function searchTransfers(
  request: TransferSearchRequest
): Promise<TransferResult<{ results: TransferSearchResult[] }>> {
  const live = liveTransferAdapters();
  if (live.length === 0) {
    return {
      ok: false,
      error: transferError("not_configured", TRANSFER_INVENTORY_UNAVAILABLE_MESSAGE),
    };
  }
  const collected: TransferSearchResult[] = [];
  for (const adapter of live) {
    if (!adapter.capabilities().search) continue;
    const result = await adapter.search(request);
    if (result.ok) collected.push(...result.data.results);
  }
  return { ok: true, data: { results: collected } };
}

export async function transferAvailability(request: TransferAvailabilityRequest) {
  const live = liveTransferAdapters();
  if (live.length === 0) {
    return {
      ok: false as const,
      error: transferError("not_configured", TRANSFER_INVENTORY_UNAVAILABLE_MESSAGE),
    };
  }
  if (!live[0].capabilities().availability) {
    return {
      ok: false as const,
      error: transferError(
        "capability_unsupported",
        "No live provider supports transfer availability."
      ),
    };
  }
  return live[0].availability(request);
}

export async function transferQuote(request: TransferQuoteRequest) {
  const live = liveTransferAdapters();
  if (live.length === 0) {
    return {
      ok: false as const,
      error: transferError("not_configured", TRANSFER_INVENTORY_UNAVAILABLE_MESSAGE),
    };
  }
  return live[0].quote(request);
}

export async function transferHold(request: TransferHoldRequest) {
  if (!request.idempotency_key.trim()) {
    return {
      ok: false as const,
      error: transferError("bad_request", "idempotency_key is required for hold."),
    };
  }
  const live = liveTransferAdapters();
  if (live.length === 0) {
    return {
      ok: false as const,
      error: transferError("contract_required", TRANSFER_INVENTORY_UNAVAILABLE_MESSAGE),
    };
  }
  return live[0].hold(request);
}

export async function transferConfirm(_request: TransferConfirmRequest) {
  return {
    ok: false as const,
    error: transferError(
      "contract_required",
      "Transfer booking confirmation is disabled until a live supplier contract exists."
    ),
  };
}

