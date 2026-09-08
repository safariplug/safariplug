import type { HotelAdapter } from "./adapter";
import { hotelError } from "./errors";
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

type LockTripLocation = {
  id: string | number;
  name?: string;
  type?: string;
  fullName?: string;
};

type LockTripSearchResult = {
  hotels?: Array<{
    hotelId?: string | number;
    name?: string;
    starRating?: number;
    minPrice?: number;
    currency?: string;
    hasFreeCancellation?: boolean;
  }>;
  searchStatus?: string;
  hasMore?: boolean;
};

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function asError(error: unknown): { code: "timeout" | "provider_error"; message: string } {
  return {
    code: error instanceof Error && error.name === "AbortError" ? "timeout" : "provider_error",
    message: error instanceof Error ? error.message : "LockTrip request failed.",
  };
}

export class LockTripHotelAdapter implements HotelAdapter {
  readonly key = "locktrip" as const;
  readonly name = "LockTrip";
  readonly circuit: CircuitState = "closed";

  private get baseUrl(): string {
    return env("SAFARIPLUG_HOTEL_LOCKTRIP_BASE_URL") || DEFAULT_BASE_URL;
  }

  private get nationality(): string {
    return (env("SAFARIPLUG_HOTEL_LOCKTRIP_NATIONALITY") || DEFAULT_NATIONALITY).toUpperCase();
  }

  private async call<T>(tool: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const token = env("SAFARIPLUG_HOTEL_LOCKTRIP_API_KEY");
      const response = await fetch(`${this.baseUrl}/${tool}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
      const text = await response.text();
      let data: unknown = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text };
      }
      if (!response.ok) {
        const message =
          typeof data === "object" && data && "message" in data
            ? String((data as { message?: unknown }).message)
            : `LockTrip returned HTTP ${response.status}.`;
        throw new Error(message);
      }
      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  capabilities(): HotelCapabilities {
    return {
      search: true,
      availability: false,
      quote: false,
      hold: false,
      confirm: false,
      cancel: false,
    };
  }

  credentialsPresent(): boolean {
    return true;
  }

  contractImplemented(): boolean {
    return true;
  }

  status(): HotelProviderStatus {
    return "configured";
  }

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
      const locations = await this.call<{ locations?: LockTripLocation[] }>("search_location", {
        query: request.destination,
      });
      const location = locations.locations?.find((item) => item.id != null);
      if (!location) {
        return {
          ok: false,
          error: hotelError("bad_request", `LockTrip could not resolve destination: ${request.destination}`, false),
        };
      }

      const rooms = Array.from({ length: Math.max(1, request.rooms) }, (_, index) => ({
        adults: index === 0 ? Math.max(1, request.adults ?? request.guests) : 1,
        childrenAges: [],
      }));

      const started = await this.call<{ searchKey?: string }>("hotel_search", {
        regionId: String(location.id),
        startDate: request.check_in,
        endDate: request.check_out,
        currency: request.currency || "USD",
        rooms,
        nationality: this.nationality,
      });

      if (!started.searchKey) {
        return {
          ok: false,
          error: hotelError("provider_error", "LockTrip did not return a search key.", true),
        };
      }

      let result: LockTripSearchResult = {};
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 500 : 750));
        result = await this.call<LockTripSearchResult>("get_search_results", {
          searchKey: started.searchKey,
          page: 0,
          size: 100,
          currency: request.currency || "USD",
          sortBy: "PRICE_ASC",
        });
        if ((result.searchStatus || "").toUpperCase() === "COMPLETED") break;
      }

      const hotels = (result.hotels || []).map((hotel) => ({
        provider: this.key,
        property_id: String(hotel.hotelId ?? ""),
        property_name: hotel.name || "LockTrip hotel",
        room_id: null,
        rate_id: null,
        currency: hotel.currency || request.currency || "USD",
        total:
          typeof hotel.minPrice === "number"
            ? { amount: hotel.minPrice, currency: hotel.currency || request.currency || "USD" }
            : null,
        cancellation:
          hotel.hasFreeCancellation == null
            ? null
            : hotel.hasFreeCancellation
              ? "Free cancellation"
              : "Non-refundable",
        availability: "available" as const,
        source: "supplier" as const,
      }));

      return { ok: true, data: { provider: this.key, results: hotels } };
    } catch (error) {
      const mapped = asError(error);
      return { ok: false, error: hotelError(mapped.code, mapped.message, mapped.code === "timeout") };
    }
  }

  async availability(_request: HotelAvailabilityRequest): Promise<HotelResult<HotelAvailabilityResponse>> {
    return {
      ok: false,
      error: hotelError("capability_unsupported", "LockTrip search is live, but property-room availability is not wired yet.", false),
    };
  }

  async quote(_request: HotelQuoteRequest): Promise<HotelResult<HotelQuoteResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "LockTrip quoting is not wired yet.", false) };
  }

  async hold(_request: HotelHoldRequest): Promise<HotelResult<HotelHoldResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "LockTrip holds are not wired yet.", false) };
  }

  async confirm(_request: HotelConfirmRequest): Promise<HotelResult<HotelConfirmResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "LockTrip confirmation is not wired yet.", false) };
  }

  async cancel(_request: HotelCancelRequest): Promise<HotelResult<HotelCancelResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "LockTrip cancellation is not wired yet.", false) };
  }
}
