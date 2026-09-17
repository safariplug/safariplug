import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { gunzipSync } from "node:zlib";
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

const DEFAULT_MARKUP_PERCENT = 10;
const DEFAULT_CUSTOMER_CURRENCY = "KES";
const HOTELBEDS_MAX_HOTELS_PER_AVAILABILITY = 2000;
const HOTELBEDS_DEFAULT_TIMEOUT_MS = 15000;
const HOTELBEDS_BOOKING_TIMEOUT_MS = 65000;

type HotelbedsRate = {
  rateKey?: string;
  rateType?: string;
  rateClass?: string;
  net?: string | number;
  sellingRate?: string | number;
  hotelMandatory?: boolean | null;
  boardCode?: string;
  boardName?: string;
  rooms?: number;
  adults?: number;
  children?: number;
  cancellationPolicies?: Array<{ amount?: string | number; from?: string }>;
};

type HotelbedsRoom = {
  code?: string;
  name?: string;
  rates?: HotelbedsRate[];
};

type HotelbedsHotel = {
  code?: number | string;
  name?: string;
  categoryCode?: string;
  categoryName?: string;
  destinationCode?: string;
  destinationName?: string;
  latitude?: string | number;
  longitude?: string | number;
  minRate?: string | number;
  maxRate?: string | number;
  currency?: string;
  rooms?: HotelbedsRoom[];
};

type HotelbedsAvailability = {
  hotels?: {
    checkIn?: string;
    total?: number;
    checkOut?: string;
    hotels?: HotelbedsHotel[];
  };
};

type HotelbedsCheckRate = {
  hotel?: HotelbedsHotel;
};

type HotelbedsBooking = {
  booking?: {
    reference?: string;
    clientReference?: string;
    status?: string;
    totalNet?: number;
    currency?: string;
    hotel?: HotelbedsHotel;
  };
};

type RequestOptions = {
  requireMtls?: boolean;
  timeoutMs?: number;
};

function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

function pemEnv(primary: string, fallback: string) {
  const value = env(primary) || env(fallback);
  return value?.replace(/\\n/g, "\n");
}

export function hotelbedsSignature(apiKey: string, secret: string, timestampSeconds = Math.floor(Date.now() / 1000)) {
  return createHash("sha256").update(`${apiKey}${secret}${timestampSeconds}`).digest("hex");
}

function environment() {
  return (env("SAFARIPLUG_HOTEL_HOTELBEDS_ENV") || "test").toLowerCase() === "production" ? "production" : "test";
}

function standardBaseUrl() {
  return environment() === "production" ? "https://api.hotelbeds.com" : "https://api.test.hotelbeds.com";
}

function mtlsBaseUrl() {
  return environment() === "production" ? "https://api-mtls.hotelbeds.com" : "https://api-mtls.test.hotelbeds.com";
}

function credentials() {
  return {
    apiKey: env("SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY"),
    secret: env("SAFARIPLUG_HOTEL_HOTELBEDS_SECRET"),
    cert: pemEnv("SAFARIPLUG_HOTEL_HOTELBEDS_CERT_PEM", "SAFARIPLUG_HOTEL_HOTELBEDS_CERT"),
    key: pemEnv("SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY_PEM", "SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY"),
    ca: pemEnv("SAFARIPLUG_HOTEL_HOTELBEDS_CA_PEM", "SAFARIPLUG_HOTEL_HOTELBEDS_CA"),
  };
}

function parseDestinationMap(): Record<string, number[]> {
  const raw = env("SAFARIPLUG_HOTEL_HOTELBEDS_DESTINATION_MAP");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mapped: Record<string, number[]> = {};
    for (const [name, value] of Object.entries(parsed)) {
      const values = Array.isArray(value) ? value : [value];
      const codes = values.map(Number).filter((code) => Number.isInteger(code) && code > 0);
      if (codes.length) mapped[name.trim().toLowerCase()] = codes;
    }
    return mapped;
  } catch {
    return {};
  }
}

function hotelCodesForDestination(destination: string): number[] {
  const direct = destination.split(",").map((value) => Number(value.trim())).filter((code) => Number.isInteger(code) && code > 0);
  if (direct.length && destination.split(",").every((value) => /^\s*\d+\s*$/.test(value))) {
    return direct.slice(0, HOTELBEDS_MAX_HOTELS_PER_AVAILABILITY);
  }
  return (parseDestinationMap()[destination.trim().toLowerCase()] || []).slice(0, HOTELBEDS_MAX_HOTELS_PER_AVAILABILITY);
}

function distributeAdults(guests: number, rooms: number) {
  const roomCount = Math.max(1, Math.floor(rooms));
  const adultCount = Math.max(roomCount, Math.floor(guests));
  return Array.from({ length: roomCount }, (_, index) => {
    const base = Math.floor(adultCount / roomCount);
    const remainder = adultCount % roomCount;
    return base + (index < remainder ? 1 : 0);
  });
}

export function buildHotelbedsOccupancies(request: Pick<HotelSearchRequest, "rooms" | "guests" | "adults" | "children" | "child_ages">) {
  const roomCount = Math.max(1, Math.floor(request.rooms));
  const adults = Math.max(roomCount, Math.floor(request.adults ?? request.guests));
  const children = Math.max(0, Math.floor(request.children || 0));
  const ages = request.child_ages || [];
  if (children > 0 && ages.length !== children) {
    throw new Error("Hotelbeds requires an age for every child.");
  }
  const childAgesByRoom = Array.from({ length: roomCount }, () => [] as number[]);
  ages.forEach((age, index) => childAgesByRoom[index % roomCount].push(age));
  return distributeAdults(adults, roomCount).map((roomAdults, index) => {
    const childAges = childAgesByRoom[index];
    return {
      rooms: 1,
      adults: roomAdults,
      children: childAges.length,
      ...(childAges.length ? { paxes: childAges.map((age) => ({ type: "CH" as const, age })) } : {}),
    };
  });
}

function firstRate(hotel: HotelbedsHotel) {
  for (const room of hotel.rooms || []) {
    const rate = room.rates?.[0];
    if (rate?.rateKey) return { room, rate };
  }
  return null;
}

function cancellationText(rate: HotelbedsRate) {
  const policy = rate.cancellationPolicies?.[0];
  if (!policy) return rate.rateClass === "NRF" ? "Non-refundable" : null;
  if (Number(policy.amount || 0) === 0 && policy.from) return `Free cancellation until ${policy.from} (hotel destination local time)`;
  if (policy.from) return `Cancellation charges apply from ${policy.from} (hotel destination local time)`;
  return rate.rateClass === "NRF" ? "Non-refundable" : "Cancellation restrictions may apply";
}

async function retailAmount(amount: number, supplierCurrency: string, requestedCurrency?: string) {
  const markupPercent = Number(env("SAFARIPLUG_HOTEL_MARKUP_PERCENT") || DEFAULT_MARKUP_PERCENT);
  const safeMarkup = Number.isFinite(markupPercent) && markupPercent >= 0 ? markupPercent : DEFAULT_MARKUP_PERCENT;
  const retailSupplier = Math.round(amount * (1 + safeMarkup / 100) * 100) / 100;
  const target = (requestedCurrency || env("SAFARIPLUG_DEFAULT_CURRENCY") || DEFAULT_CUSTOMER_CURRENCY).toUpperCase();
  const converted = await convertCurrency(retailSupplier, supplierCurrency.toUpperCase(), target);
  return { amount: converted.amount, currency: target };
}

function requestJson<T>(url: URL, method: "GET" | "POST" | "DELETE", body?: unknown, options: RequestOptions = {}): Promise<T> {
  const auth = credentials();
  const requireMtls = options.requireMtls ?? true;
  const timeoutMs = options.timeoutMs ?? HOTELBEDS_DEFAULT_TIMEOUT_MS;
  if (!auth.apiKey || !auth.secret) return Promise.reject(new Error("Hotelbeds API key and secret are not configured."));
  if (requireMtls && (!auth.cert || !auth.key)) return Promise.reject(new Error("Hotelbeds mTLS certificate and private key are not configured."));
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const signature = hotelbedsSignature(auth.apiKey, auth.secret);
  return new Promise<T>((resolve, reject) => {
    const request = httpsRequest(url, {
      method,
      cert: requireMtls ? auth.cert : undefined,
      key: requireMtls ? auth.key : undefined,
      ca: requireMtls ? auth.ca : undefined,
      rejectUnauthorized: true,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "Api-key": auth.apiKey!,
        "X-Signature": signature,
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
      },
      timeout: timeoutMs,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        const raw = Buffer.concat(chunks);
        let decoded = raw;
        if (String(response.headers["content-encoding"] || "").toLowerCase().includes("gzip")) {
          try { decoded = gunzipSync(raw); } catch (error) { reject(error); return; }
        }
        const text = decoded.toString("utf8");
        let parsed: unknown = {};
        try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { message: text }; }
        const status = response.statusCode || 500;
        if (status < 200 || status >= 300) {
          const candidate = parsed as { error?: { message?: string }; message?: string };
          reject(new Error(candidate.error?.message || candidate.message || `Hotelbeds returned HTTP ${status}.`));
          return;
        }
        resolve(parsed as T);
      });
    });
    request.on("timeout", () => request.destroy(new Error("Hotelbeds request timed out.")));
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

export class HotelbedsHotelAdapter implements HotelAdapter {
  readonly key = "hotelbeds" as const;
  readonly name = "Hotelbeds";
  readonly circuit: CircuitState = "closed";

  capabilities(): HotelCapabilities {
    return { search: true, availability: false, quote: false, hold: false, confirm: false, cancel: false };
  }

  credentialsPresent() {
    const auth = credentials();
    return Boolean(auth.apiKey && auth.secret && auth.cert && auth.key);
  }

  contractImplemented() { return true; }

  status(): HotelProviderStatus {
    return this.credentialsPresent() ? "configured" : "not_configured";
  }

  async health(): Promise<HotelHealth> {
    const started = Date.now();
    const checkedAt = new Date().toISOString();
    const auth = credentials();
    if (!auth.apiKey || !auth.secret) {
      return { provider: this.key, status: "not_configured", configured: false, contract_implemented: true, reachable: false, authenticated: false, latency_ms: 0, last_success_at: null, last_error: "Hotelbeds API key and secret are not configured.", checked_at: checkedAt };
    }
    if (!auth.cert || !auth.key) {
      return { provider: this.key, status: "not_configured", configured: false, contract_implemented: true, reachable: false, authenticated: false, latency_ms: 0, last_success_at: null, last_error: "Hotelbeds mTLS certificate and private key are required for hotel availability and booking operations.", checked_at: checkedAt };
    }
    try {
      const url = new URL("/hotel-api/1.0/status", standardBaseUrl());
      await requestJson(url, "GET", undefined, { requireMtls: false });
      return { provider: this.key, status: "healthy", configured: true, contract_implemented: true, reachable: true, authenticated: true, latency_ms: Date.now() - started, last_success_at: checkedAt, last_error: null, checked_at: checkedAt };
    } catch (error) {
      return { provider: this.key, status: "degraded", configured: true, contract_implemented: true, reachable: false, authenticated: false, latency_ms: Date.now() - started, last_success_at: null, last_error: error instanceof Error ? error.message : "Hotelbeds health check failed.", checked_at: checkedAt };
    }
  }

  async search(request: HotelSearchRequest): Promise<HotelResult<HotelSearchResponse>> {
    if (!this.credentialsPresent()) return { ok: false, error: hotelError("not_configured", "Hotelbeds requires an API key, secret, mTLS certificate and private key.", false) };
    const hotelCodes = hotelCodesForDestination(request.destination);
    if (!hotelCodes.length) return { ok: false, error: hotelError("bad_request", `No Hotelbeds hotel-code mapping is configured for ${request.destination}.`, false) };
    try {
      const occupancies = buildHotelbedsOccupancies(request);
      const sourceMarket = env("SAFARIPLUG_HOTEL_HOTELBEDS_SOURCE_MARKET");
      const url = new URL("/hotel-api/1.0/hotels", mtlsBaseUrl());
      const response = await requestJson<HotelbedsAvailability>(url, "POST", {
        stay: { checkIn: request.check_in, checkOut: request.check_out },
        occupancies,
        hotels: { hotel: hotelCodes },
        ...(sourceMarket ? { sourceMarket } : {}),
      });
      const results = await Promise.all((response.hotels?.hotels || []).map(async (hotel) => {
        const selected = firstRate(hotel);
        const rate = selected?.rate;
        const supplierCurrency = String(hotel.currency || "EUR").toUpperCase();
        const net = Number(rate?.net ?? rate?.sellingRate ?? hotel.minRate);
        const customer = Number.isFinite(net) ? await retailAmount(net, supplierCurrency, request.currency) : null;
        return {
          provider: this.key,
          property_id: String(hotel.code ?? ""),
          property_name: hotel.name || "Hotelbeds hotel",
          room_id: selected?.room.code || null,
          rate_id: rate?.rateKey || null,
          currency: customer?.currency || (request.currency || DEFAULT_CUSTOMER_CURRENCY).toUpperCase(),
          total: customer,
          cancellation: rate ? cancellationText(rate) : null,
          availability: rate?.rateKey ? "available" as const : "unknown" as const,
          source: "supplier" as const,
          supplier_context: {
            search_key: rate?.rateType || undefined,
            region_id: hotel.destinationCode || undefined,
            rate_class: rate?.rateClass || undefined,
            board_code: rate?.boardCode || undefined,
            board_name: rate?.boardName || undefined,
          },
        };
      }));
      return { ok: true, data: { provider: this.key, results } };
    } catch (error) {
      return { ok: false, error: hotelError("provider_error", error instanceof Error ? error.message : "Hotelbeds availability failed.", true) };
    }
  }

  async checkRate(rateKey: string) {
    const url = new URL("/hotel-api/1.0/checkrates", mtlsBaseUrl());
    return requestJson<HotelbedsCheckRate>(url, "POST", { rooms: [{ rateKey }] });
  }

  async createBooking(input: { holder: { name: string; surname: string }; rooms: Array<{ rateKey: string; paxes: Array<{ roomId: number; type: "AD" | "CH"; name: string; surname: string }> }>; clientReference: string; remark?: string; tolerance?: number }) {
    const url = new URL("/hotel-api/1.0/bookings", mtlsBaseUrl());
    return requestJson<HotelbedsBooking>(url, "POST", input, { timeoutMs: HOTELBEDS_BOOKING_TIMEOUT_MS });
  }

  async getBooking(reference: string) {
    const url = new URL(`/hotel-api/1.0/bookings/${encodeURIComponent(reference)}`, mtlsBaseUrl());
    return requestJson<HotelbedsBooking>(url, "GET");
  }

  async cancelBooking(reference: string, cancellationFlag: "SIMULATION" | "CANCELLATION" = "SIMULATION") {
    const url = new URL(`/hotel-api/1.0/bookings/${encodeURIComponent(reference)}?cancellationFlag=${cancellationFlag}`, mtlsBaseUrl());
    return requestJson<HotelbedsBooking>(url, "DELETE");
  }

  async availability(_request: HotelAvailabilityRequest): Promise<HotelResult<HotelAvailabilityResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Use Hotelbeds availability search and rateKey results.", false) };
  }

  async quote(_request: HotelQuoteRequest): Promise<HotelResult<HotelQuoteResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Use Hotelbeds CheckRate for RECHECK rateKeys before booking.", false) };
  }

  async hold(_request: HotelHoldRequest): Promise<HotelResult<HotelHoldResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Hotelbeds does not use SafariPlug's generic hold contract.", false) };
  }

  async confirm(_request: HotelConfirmRequest): Promise<HotelResult<HotelConfirmResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Hotelbeds booking confirmation requires the selected rateKey and named paxes.", false) };
  }

  async cancel(_request: HotelCancelRequest): Promise<HotelResult<HotelCancelResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Use Hotelbeds cancellation simulation before explicit cancellation.", false) };
  }
}
