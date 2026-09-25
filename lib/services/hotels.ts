import { liveHotelAdapters } from "@/lib/integrations/hotels/registry";
import { hotelError } from "@/lib/integrations/hotels/errors";
import {
  HOTEL_PROVIDER_KEYS,
  type HotelAvailabilityRequest,
  type HotelAvailabilityResponse,
  type HotelConfirmRequest,
  type HotelHoldRequest,
  type HotelProviderKey,
  type HotelQuoteRequest,
  type HotelQuoteResponse,
  type HotelResult,
  type HotelSearchRequest,
  type HotelSearchResult,
  type HotelSupplierOption,
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

  const adults = input.adults === undefined ? undefined : Number(input.adults);
  const children = input.children === undefined ? undefined : Number(input.children);
  if (adults !== undefined && (!Number.isInteger(adults) || adults < 1 || adults > 20)) {
    throw new Error("adults must be an integer between 1 and 20.");
  }
  if (children !== undefined && (!Number.isInteger(children) || children < 0 || children > 10)) {
    throw new Error("children must be an integer between 0 and 10.");
  }

  const child_ages = (input.child_ages || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number);
  if (child_ages.some((age) => !Number.isInteger(age) || age < 0 || age > 17)) {
    throw new Error("child_ages must be comma-separated integers between 0 and 17.");
  }
  if ((children || 0) > 0 && child_ages.length !== children) {
    throw new Error("A child age is required for every child.");
  }
  if ((children || 0) === 0 && child_ages.length > 0) {
    throw new Error("child_ages cannot be supplied when children is 0.");
  }

  const currency = input.currency?.trim().toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("currency must be a 3-letter code.");
  }

  const locationScopeValue = input.location_scope?.trim().toLowerCase();
  const location_scope = locationScopeValue === undefined || locationScopeValue === ""
    ? "specific"
    : locationScopeValue;
  if (location_scope !== "specific" && location_scope !== "destination") {
    throw new Error("location_scope must be specific or destination.");
  }

  const bookableValue = input.bookable_only?.trim().toLowerCase();
  let bookable_only = true;
  if (bookableValue && !["true", "1", "false", "0"].includes(bookableValue)) {
    throw new Error("bookable_only must be true or false.");
  }
  if (bookableValue === "false" || bookableValue === "0") bookable_only = false;

  const providerValue = input.provider?.trim().toLowerCase();
  let provider: HotelProviderKey | undefined;
  if (providerValue) {
    if (!HOTEL_PROVIDER_KEYS.includes(providerValue as HotelProviderKey)) {
      throw new Error("provider is not supported.");
    }
    provider = providerValue as HotelProviderKey;
  }

  return {
    destination,
    check_in,
    check_out,
    guests,
    rooms,
    currency,
    adults,
    children,
    child_ages: child_ages.length ? child_ages : undefined,
    provider,
    location_scope,
    bookable_only,
  };
}

function normalizeHotelIdentity(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hotelIdentity(result: HotelSearchResult) {
  return {
    name: normalizeHotelIdentity(result.property_name),
    address: normalizeHotelIdentity(
      typeof result.supplier_context?.address === "string"
        ? result.supplier_context.address
        : ""
    ),
  };
}

function compatibleHotelIdentity(a: HotelSearchResult, b: HotelSearchResult) {
  const left = hotelIdentity(a);
  const right = hotelIdentity(b);
  if (!left.name || !right.name || left.name !== right.name) return false;
  if (left.address && right.address && left.address !== right.address) return false;
  return true;
}

function asSupplierOption(result: HotelSearchResult): HotelSupplierOption {
  return {
    provider: result.provider,
    property_id: result.property_id,
    property_name: result.property_name,
    room_id: result.room_id,
    rate_id: result.rate_id,
    currency: result.currency,
    total: result.total,
    cancellation: result.cancellation,
    availability: result.availability,
    supplier_context: result.supplier_context,
  };
}

function optionRank(result: HotelSearchResult) {
  const bookable = result.availability === "available" ? 0 : 1;
  const hasTotal = result.total && Number.isFinite(result.total.amount) ? 0 : 1;
  const total = result.total && Number.isFinite(result.total.amount)
    ? result.total.amount
    : Number.POSITIVE_INFINITY;
  return [bookable, hasTotal, total] as const;
}

function isBetterHotelOption(candidate: HotelSearchResult, current: HotelSearchResult) {
  const a = optionRank(candidate);
  const b = optionRank(current);
  if (a[0] !== b[0]) return a[0] < b[0];
  if (a[1] !== b[1]) return a[1] < b[1];

  if (
    candidate.total &&
    current.total &&
    candidate.total.currency === current.total.currency &&
    candidate.total.amount !== current.total.amount
  ) {
    return candidate.total.amount < current.total.amount;
  }

  return false;
}

export function dedupeHotelResults(results: HotelSearchResult[]): HotelSearchResult[] {
  const groups: HotelSearchResult[][] = [];
  for (const result of results) {
    const matchingGroup = groups.find((group) =>
      group.some((existing) => compatibleHotelIdentity(existing, result))
    );
    if (matchingGroup) matchingGroup.push(result);
    else groups.push([result]);
  }

  return groups.map((group) => {
    let selected = group[0];
    for (const candidate of group.slice(1)) {
      if (isBetterHotelOption(candidate, selected)) selected = candidate;
    }

    const supplierOptions = group
      .map(asSupplierOption)
      .sort((a, b) => {
        if (a.total && b.total && a.total.currency === b.total.currency) {
          return a.total.amount - b.total.amount;
        }
        if (a.total && !b.total) return -1;
        if (!a.total && b.total) return 1;
        return a.provider.localeCompare(b.provider);
      });

    return {
      ...selected,
      supplier_options: supplierOptions.length > 1 ? supplierOptions : undefined,
    };
  });
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
  const live = liveHotelAdapters().filter((adapter) => !request.provider || adapter.key === request.provider);
  if (live.length === 0) {
    return {
      ok: false,
      error: hotelError(
        "not_configured",
        request.provider
          ? `Hotel provider ${request.provider} is not configured for live search.`
          : HOTEL_INVENTORY_UNAVAILABLE_MESSAGE,
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
  return { ok: true, data: { results: dedupeHotelResults(collected) } };
}

export async function hotelAvailability(
  request: HotelAvailabilityRequest
): Promise<HotelResult<HotelAvailabilityResponse>> {
  const live = liveHotelAdapters().filter((adapter) => !request.provider || adapter.key === request.provider);
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
  const live = liveHotelAdapters().filter((adapter) => adapter.key === request.provider);
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
  const live = liveHotelAdapters().filter((adapter) => adapter.key === request.quote.provider);
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
