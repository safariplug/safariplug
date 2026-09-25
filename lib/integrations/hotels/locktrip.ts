import type { HotelAdapter } from "./adapter";
import { hotelError } from "./errors";
import { convertCurrency } from "@/lib/currency/exchange-rates";
import type {
  CircuitState,
  HotelAvailabilityRequest,
  HotelAvailabilityResponse,
  HotelCancelRequest,
  HotelCancelResponse,
  HotelCapabilities,
  HotelConfirmRequest,
  HotelConfirmResponse,
  HotelHealth,
  HotelHoldRequest,
  HotelHoldResponse,
  HotelProviderStatus,
  HotelQuoteRequest,
  HotelQuoteResponse,
  HotelResult,
  HotelSearchRequest,
  HotelSearchResponse,
} from "./types";

const DEFAULT_BASE_URL = "https://locktrip.com/mcp/tools";
const DEFAULT_NATIONALITY = "US";
const DEFAULT_MARKUP_PERCENT = 10;
const DEFAULT_SUPPLIER_CURRENCY = "USD";
const DEFAULT_CUSTOMER_CURRENCY = "KES";

type Location = { id: string | number; name?: string; fullName?: string; country?: string; type?: string };
type SearchResults = {
  searchStatus?: string;
  hotels?: Array<{
    hotelId?: string | number;
    name?: string;
    starRating?: number;
    address?: string;
    latitude?: number;
    longitude?: number;
    images?: string[];
    amenities?: string[];
    minPrice?: number;
    originalPrice?: number;
    currency?: string;
    discountScore?: number;
    reviewScore?: number;
    reviewCount?: number | null;
    hasFreeCancellation?: boolean;
    isRefundable?: boolean;
    refundableUntil?: string | null;
    payment?: string;
    distance?: number;
    boardType?: string | null;
    availableMealTypes?: string[];
  }>;
};

type RoomsResponse = {
  hotelId: string;
  hotelName?: string;
  checkIn?: string;
  checkOut?: string;
  packages?: Array<{
    quoteId: string;
    packageId?: string;
    roomName?: string;
    roomDescription?: string;
    mealType?: string;
    mealDescription?: string;
    maxOccupancy?: number;
    amenities?: string[];
    price: number;
    currency: string;
    pricePerNight?: number;
    totalNights?: number;
    isRefundable?: boolean;
  }>;
};

type PrepareResponse = {
  preparedBookingId: string;
  bookingInternalId?: string;
  price: number;
  currency: string;
  payment?: string;
  discount?: unknown;
  taxes?: unknown[];
  essentialInformation?: string[];
};

type CheckoutResponse = {
  checkoutUrl?: string;
  url?: string;
  checkoutToken?: string;
  sessionId?: string;
  expiresInMinutes?: number;
  message?: string;
};

export type LockTripBookingDetails = {
  bookingId: string;
  bookingReferenceId?: string;
  status?: string;
  hotel?: { id?: string | number; name?: string; address?: string; city?: string; country?: string; starRating?: number };
  checkIn?: string;
  checkOut?: string;
  totalPrice?: number;
  currency?: string;
  paymentStatus?: string;
  createdAt?: string;
  confirmedAt?: string | null;
  rooms?: unknown[];
  contactPerson?: unknown;
  cancellationPolicy?: unknown | null;
};

export type LockTripConfirmResponse = {
  accepted?: boolean;
  message?: string | null;
  voucherUrl?: string | null;
  serviceUnavailable?: boolean;
};

export type LockTripHotelDetails = {
  hotel?: {
    id?: number;
    name?: string;
    country?: string;
    city?: string;
    star?: number;
    address?: string;
    latitude?: number;
    longitude?: number;
    description?: string;
    phone?: string | null;
    hotelPhotos?: Array<{ url?: string }>;
    reviews?: { scoreSummary?: number; reviewsCount?: number; keyWords?: string[] };
    hotelAmenities?: Array<{ categoryName?: string; features?: Array<{ name?: string }> }>;
  };
  additionalImages?: Array<{ url?: string }>;
};

export type LockTripCancellationPolicy = {
  hotelId?: string;
  policies?: Array<{
    packageId?: string;
    isRefundable?: boolean;
    freeCancellationUntil?: string | null;
    fees?: Array<{ fromDate?: string; toDate?: string | null; amount?: number; currency?: string; percentage?: number | null }>;
    remarks?: string[] | null;
  }>;
};

export type LockTripBookingList = {
  bookings?: Array<{
    bookingId: string;
    bookingReferenceId?: string;
    hotelName?: string;
    hotelCity?: string;
    checkIn?: string;
    checkOut?: string;
    status?: string;
    guestName?: string;
    roomCount?: number;
    createdAt?: string;
    hotelPhoto?: string | null;
  }>;
  totalCount?: number;
  page?: number;
  pageSize?: number;
};

export type LockTripCancelResult = { success?: boolean; message?: string };

function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

function asError(error: unknown): { code: "timeout" | "provider_error"; message: string } {
  return {
    code: error instanceof Error && error.name === "AbortError" ? "timeout" : "provider_error",
    message: error instanceof Error ? error.message : "LockTrip request failed.",
  };
}

function retailPrice(netPrice: number) {
  return Math.round(netPrice * (1 + DEFAULT_MARKUP_PERCENT / 100) * 100) / 100;
}

function customerCurrency(requested?: string) {
  return (requested || env("SAFARIPLUG_DEFAULT_CURRENCY") || DEFAULT_CUSTOMER_CURRENCY).toUpperCase();
}

function normalizeLocation(value?: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function locationMatchScore(location: Location, destination: string) {
  const query = normalizeLocation(destination);
  if (!query) return 0;
  const candidates = [location.name, location.fullName]
    .map(normalizeLocation)
    .filter(Boolean);
  let score = 0;
  for (const candidate of candidates) {
    if (candidate === query) score = Math.max(score, 100);
    else if (candidate.startsWith(query + " ")) score = Math.max(score, 90);
    else {
      const tokens = query.split(" ").filter(Boolean);
      if (tokens.length && tokens.every((token) => candidate.split(" ").includes(token))) {
        score = Math.max(score, 70);
      }
    }
  }
  return score;
}

function chooseLocation(locations: Location[], destination: string, specific: boolean) {
  const ranked = locations
    .filter((item) => item.id != null)
    .map((item) => ({ item, score: locationMatchScore(item, destination) }))
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return undefined;
  if (!specific) return ranked[0]?.item;
  return ranked[0] && ranked[0].score >= 70 ? ranked[0].item : undefined;
}

async function mapRetailAmount(netPrice: number, supplierCurrency: string, requestedCurrency?: string) {
  const retailSupplier = retailPrice(netPrice);
  const target = customerCurrency(requestedCurrency);
  const converted = await convertCurrency(retailSupplier, supplierCurrency, target);
  return {
    supplierNetPrice: netPrice,
    supplierRetailPrice: retailSupplier,
    customerRetailPrice: converted.amount,
    supplierCurrency: supplierCurrency.toUpperCase(),
    customerCurrency: target,
    exchangeRate: converted.rate,
    markupPercent: DEFAULT_MARKUP_PERCENT,
  };
}

export class LockTripHotelAdapter implements HotelAdapter {
  readonly key = "locktrip" as const;
  readonly name = "LockTrip";
  readonly circuit: CircuitState = "closed";

  private get baseUrl() {
    return env("SAFARIPLUG_HOTEL_LOCKTRIP_BASE_URL") || DEFAULT_BASE_URL;
  }

  private get nationality() {
    return (env("SAFARIPLUG_HOTEL_LOCKTRIP_NATIONALITY") || DEFAULT_NATIONALITY).toUpperCase();
  }

  private async call<T>(tool: string, body: Record<string, unknown>, token?: string, requireAuth = false): Promise<T> {
    if (requireAuth && !token) throw new Error("LockTrip authentication is required for this action.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (token) headers.authorization = `Bearer ${token}`;
      const response = await fetch(`${this.baseUrl}/${tool}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
      const raw = await response.text();
      let data: unknown = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
      if (!response.ok) {
        const candidate = data as { error?: { message?: unknown; data?: { mcpCode?: unknown } }; message?: unknown };
        const message = String(candidate.error?.message || candidate.message || `LockTrip returned HTTP ${response.status}.`);
        const code = candidate.error?.data?.mcpCode ? ` (${String(candidate.error.data.mcpCode)})` : "";
        throw new Error(`${message}${code}`);
      }
      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  capabilities(): HotelCapabilities {
    return { search: true, availability: true, quote: true, hold: false, confirm: true, cancel: true };
  }

  // Search/browse tools are public, so the provider is available without a credential.
  credentialsPresent() { return true; }
  contractImplemented() { return true; }
  status(): HotelProviderStatus { return "configured"; }

  async health(): Promise<HotelHealth> {
    const started = Date.now();
    try {
      await this.call("search_location", { query: "Nairobi" });
      return {
        provider: this.key,
        status: "healthy",
        configured: true,
        contract_implemented: true,
        reachable: true,
        authenticated: null,
        latency_ms: Date.now() - started,
        last_success_at: new Date().toISOString(),
        last_error: null,
        checked_at: new Date().toISOString(),
      };
    } catch (error) {
      return {
        provider: this.key,
        status: "degraded",
        configured: true,
        contract_implemented: true,
        reachable: false,
        authenticated: null,
        latency_ms: Date.now() - started,
        last_success_at: null,
        last_error: error instanceof Error ? error.message : "LockTrip health check failed.",
        checked_at: new Date().toISOString(),
      };
    }
  }

  async search(request: HotelSearchRequest): Promise<HotelResult<HotelSearchResponse>> {
    try {
      const locations = await this.call<{ locations?: Location[] }>("search_location", { query: request.destination });
      const location = chooseLocation(
        locations.locations || [],
        request.destination,
        request.location_scope !== "destination"
      );
      if (!location) {
        return {
          ok: false,
          error: hotelError(
            "bad_request",
            `LockTrip could not resolve the specific location: ${request.destination}. Try a neighborhood, landmark, airport, town, or city name.`,
            false
          ),
        };
      }
      const rooms = Array.from({ length: Math.max(1, request.rooms) }, (_, index) => ({
        adults: index === 0 ? Math.max(1, request.adults ?? request.guests) : 1,
        childrenAges: [],
      }));
      const supplierCurrency = DEFAULT_SUPPLIER_CURRENCY;
      const started = await this.call<{ searchKey?: string }>("hotel_search", {
        regionId: String(location.id),
        startDate: request.check_in,
        endDate: request.check_out,
        currency: supplierCurrency,
        rooms,
        nationality: this.nationality,
      });
      if (!started.searchKey) return { ok: false, error: hotelError("provider_error", "LockTrip did not return a search key.", true) };
      let result: SearchResults = {};
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 500 : 750));
        result = await this.call<SearchResults>("get_search_results", {
          searchKey: started.searchKey,
          page: 0,
          size: 100,
          currency: supplierCurrency,
          sortBy: "PRICE_ASC",
        });
        if ((result.searchStatus || "").toUpperCase() === "COMPLETED") break;
      }
      const target = customerCurrency(request.currency);
      const hotels = await Promise.all((result.hotels || []).map(async (hotel) => {
        const supplier = hotel.currency || supplierCurrency;
        const pricing = typeof hotel.minPrice === "number" ? await mapRetailAmount(hotel.minPrice, supplier, target) : null;
        return {
          provider: this.key,
          property_id: String(hotel.hotelId ?? ""),
          property_name: hotel.name || "LockTrip hotel",
          room_id: null,
          rate_id: null,
          currency: pricing?.customerCurrency || target,
          total: pricing ? { amount: pricing.customerRetailPrice, currency: pricing.customerCurrency } : null,
          cancellation: hotel.hasFreeCancellation == null ? null : hotel.hasFreeCancellation ? "Free cancellation available" : "Cancellation restrictions may apply",
          availability: "available" as const,
          source: "supplier" as const,
          supplier_context: {
            search_key: started.searchKey,
            region_id: String(location.id),
            markup_percent: DEFAULT_MARKUP_PERCENT,
            supplier_currency: pricing?.supplierCurrency || supplier,
            customer_currency: pricing?.customerCurrency || target,
            exchange_rate: pricing?.exchangeRate || 1,
            star_rating: hotel.starRating ?? null,
            address: hotel.address ?? null,
            images: hotel.images ?? [],
            amenities: hotel.amenities ?? [],
            original_price: hotel.originalPrice ?? null,
            discount_score: hotel.discountScore ?? null,
            review_score: hotel.reviewScore ?? null,
            review_count: hotel.reviewCount ?? null,
            refundable_until: hotel.refundableUntil ?? null,
            distance_km: hotel.distance ?? null,
            board_type: hotel.boardType ?? null,
            meal_types: hotel.availableMealTypes ?? [],
          },
        };
      }));
      return { ok: true, data: { provider: this.key, results: hotels } };
    } catch (error) {
      const mapped = asError(error);
      return { ok: false, error: hotelError(mapped.code, mapped.message, mapped.code === "timeout") };
    }
  }

  async getRooms(input: { hotelId: string; searchKey: string; regionId: string; checkIn: string; checkOut: string; rooms: Array<{ adults: number; childrenAges?: number[] }>; currency?: string }) {
    const response = await this.call<RoomsResponse>("get_hotel_rooms", {
      hotelId: input.hotelId,
      searchKey: input.searchKey,
      startDate: input.checkIn,
      endDate: input.checkOut,
      rooms: input.rooms,
      nationality: this.nationality,
      regionId: input.regionId,
      currency: DEFAULT_SUPPLIER_CURRENCY,
    });
    const target = customerCurrency(input.currency);
    const packages = await Promise.all((response.packages || []).map(async (pkg) => {
      const pricing = await mapRetailAmount(pkg.price, pkg.currency || DEFAULT_SUPPLIER_CURRENCY, target);
      return {
        ...pkg,
        supplierNetPrice: pkg.price,
        price: pricing.customerRetailPrice,
        retailPrice: pricing.customerRetailPrice,
        markupPercent: DEFAULT_MARKUP_PERCENT,
        supplierCurrency: pricing.supplierCurrency,
        customerCurrency: pricing.customerCurrency,
        exchangeRate: pricing.exchangeRate,
        supplierContext: { quoteId: pkg.quoteId, packageId: pkg.packageId || null },
      };
    }));
    return { ...response, packages, pricing: { markupPercent: DEFAULT_MARKUP_PERCENT, supplierCurrency: DEFAULT_SUPPLIER_CURRENCY, customerCurrency: target, displayMode: "retail" as const } };
  }

  async refreshRooms(input: { hotelId: string; regionId: string; checkIn: string; checkOut: string; rooms: Array<{ adults: number; childrenAges?: number[] }>; currency?: string }) {
    const started = await this.call<{ searchKey?: string }>("hotel_search", {
      regionId: input.regionId,
      startDate: input.checkIn,
      endDate: input.checkOut,
      currency: DEFAULT_SUPPLIER_CURRENCY,
      rooms: input.rooms,
      nationality: this.nationality,
    });
    if (!started.searchKey) throw new Error("Hotel supplier did not return a refreshed search key.");

    let seenSelectedHotel = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 500 : 750));
      const result = await this.call<SearchResults>("get_search_results", {
        searchKey: started.searchKey,
        page: 0,
        size: 100,
        currency: DEFAULT_SUPPLIER_CURRENCY,
        sortBy: "PRICE_ASC",
      });
      seenSelectedHotel = (result.hotels || []).some((hotel) => String(hotel.hotelId ?? "") === input.hotelId);
      if (seenSelectedHotel || (result.searchStatus || "").toUpperCase() === "COMPLETED") break;
    }

    if (!seenSelectedHotel) {
      return {
        searchKey: started.searchKey,
        hotelId: input.hotelId,
        packages: [],
        pricing: {
          markupPercent: DEFAULT_MARKUP_PERCENT,
          supplierCurrency: DEFAULT_SUPPLIER_CURRENCY,
          customerCurrency: customerCurrency(input.currency),
          displayMode: "retail" as const,
        },
      };
    }

    const rooms = await this.getRooms({ ...input, searchKey: started.searchKey });
    return { ...rooms, searchKey: started.searchKey };
  }

  getHotelDetails(hotelId: string, includeImages = true, imageLimit = 30) {
    return this.call<LockTripHotelDetails>("get_hotel_details", { hotelId: Number(hotelId), language: "en", includeImages, imageLimit: Math.max(1, Math.min(100, imageLimit)) });
  }

  checkCancellationPolicy(searchKey: string, hotelId: string, quoteIds: string[]) {
    const packageIds = quoteIds.map((quoteId) => quoteId.split("_")[0]).filter(Boolean);
    return this.call<LockTripCancellationPolicy>("check_cancellation_policy", { searchKey, hotelId, packageIds });
  }

  async guestLogin(email: string) {
    return (await this.call<{ token: string }>("guest_login", { email })).token;
  }

  async login(email: string, password: string) {
    return (await this.call<{ token: string }>("login", { email, password })).token;
  }

  prepareBooking(token: string, input: Record<string, unknown>) {
    return this.call<PrepareResponse>("prepare_booking", input, token, true);
  }

  createCheckout(token: string, input: { bookingId: string; currency: string; backUrl?: string; successUrl?: string }) {
    return this.call<CheckoutResponse>("create_checkout", input, token, true);
  }

  getPaymentUrl(token: string, input: { bookingId: string; currency: string; backUrl: string; successUrl?: string }) {
    return this.call<CheckoutResponse>("get_payment_url", input, token, true);
  }

  getBookingDetails(token: string, bookingId: string) {
    return this.call<LockTripBookingDetails>("get_booking_details", { bookingId }, token, true);
  }

  listBookings(token: string, type: "UPCOMING" | "COMPLETED" | "CANCELLED" | "PENDING" = "UPCOMING") {
    return this.call<LockTripBookingList>("list_bookings", { type }, token, true);
  }

  cancelBooking(token: string, bookingId: string, confirmed: boolean, reason?: string) {
    return this.call<LockTripCancelResult>("cancel_booking", { bookingId, confirmed, ...(reason ? { reason } : {}) }, token, true);
  }

  confirmBooking(token: string, input: { bookingInternalId: string; quoteId: string }) {
    return this.call<LockTripConfirmResponse>("confirm_booking", { bookingInternalId: input.bookingInternalId, quoteId: input.quoteId, paymentMethod: "CREDIT_LINE" }, token, true);
  }

  async availability(_request: HotelAvailabilityRequest): Promise<HotelResult<HotelAvailabilityResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Use LockTrip room packages for live property availability.", false) };
  }

  async quote(_request: HotelQuoteRequest): Promise<HotelResult<HotelQuoteResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Use LockTrip room packages for live quotes.", false) };
  }

  async hold(_request: HotelHoldRequest): Promise<HotelResult<HotelHoldResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "LockTrip consumer bookings do not require a separate hold.", false) };
  }

  async confirm(_request: HotelConfirmRequest): Promise<HotelResult<HotelConfirmResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Use confirmBooking for LockTrip B2B credit-line confirmation.", false) };
  }

  async cancel(_request: HotelCancelRequest): Promise<HotelResult<HotelCancelResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Use cancelBooking with an authenticated LockTrip session.", false) };
  }
}
