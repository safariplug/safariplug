import { createHash } from "node:crypto";
import https from "node:https";
import { convertCurrency } from "@/lib/currency/exchange-rates";
import { hotelError } from "./errors";
import type { HotelAdapter } from "./adapter";
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

const TEST_BASE = "https://api.test.hotelbeds.com";
const PROD_BASE = "https://api.hotelbeds.com";
const DEFAULT_MARKUP = 10;
const DEFAULT_CUSTOMER_CURRENCY = "KES";

type HbRate = {
  rateKey?: string;
  rateType?: string;
  net?: string | number;
  sellingRate?: string | number;
  boardCode?: string;
  boardName?: string;
  cancellationPolicies?: Array<{ amount?: string | number; from?: string }>;
};

type HbRoom = { code?: string; name?: string; rates?: HbRate[] };
type HbHotel = {
  code?: string | number;
  name?: string;
  categoryCode?: string;
  categoryName?: string;
  destinationCode?: string;
  destinationName?: string;
  rooms?: HbRoom[];
};

type HbAvailability = {
  hotels?: { currency?: string; hotels?: HbHotel[] };
  error?: { code?: string; message?: string };
};

type HbBooking = {
  booking?: {
    reference?: string;
    clientReference?: string;
    status?: string;
    creationDate?: string;
    holder?: { name?: string; surname?: string };
    hotel?: HbHotel;
    totalNet?: number;
    pendingAmount?: number;
    currency?: string;
  };
  error?: { code?: string; message?: string };
};

function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

function decodePem(value?: string) {
  if (!value) return undefined;
  const normalized = value.replace(/\\n/g, "\n");
  if (normalized.includes("-----BEGIN")) return normalized;
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return decoded.includes("-----BEGIN") ? decoded : normalized;
  } catch {
    return normalized;
  }
}

function markupPercent() {
  const parsed = Number(env("SAFARIPLUG_HOTEL_HOTELBEDS_MARKUP_PERCENT") || DEFAULT_MARKUP);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : DEFAULT_MARKUP;
}

function retail(net: number) {
  return Math.round(net * (1 + markupPercent() / 100) * 100) / 100;
}

function customerCurrency(requested?: string) {
  return (requested || env("SAFARIPLUG_DEFAULT_CURRENCY") || DEFAULT_CUSTOMER_CURRENCY).toUpperCase();
}

function destinationMap(): Record<string, string> {
  const raw = env("SAFARIPLUG_HOTEL_HOTELBEDS_DESTINATIONS");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => typeof value === "string" && value.trim())
        .map(([key, value]) => [key.trim().toLowerCase(), String(value).trim().toUpperCase()])
    );
  } catch {
    return {};
  }
}

function resolveDestinationCode(destination: string) {
  const value = destination.trim();
  const prefixed = value.match(/^HBX:([A-Z0-9_-]+)$/i)?.[1];
  if (prefixed) return prefixed.toUpperCase();
  const mapped = destinationMap()[value.toLowerCase()];
  if (mapped) return mapped;
  if (/^[A-Z0-9]{3,5}$/.test(value)) return value;
  return null;
}

function distributeAdults(adults: number, roomCount: number) {
  const rooms = Math.max(1, Math.floor(roomCount));
  const people = Math.max(rooms, Math.floor(adults));
  const base = Math.floor(people / rooms);
  const remainder = people % rooms;
  return Array.from({ length: rooms }, (_, index) => base + (index < remainder ? 1 : 0));
}

export class HotelbedsHotelAdapter implements HotelAdapter {
  readonly key = "hotelbeds" as const;
  readonly name = "Hotelbeds";
  readonly circuit: CircuitState = "closed";

  private get environment() {
    return (env("SAFARIPLUG_HOTEL_HOTELBEDS_ENV") || "test").toLowerCase() === "production" ? "production" : "test";
  }

  private get baseUrl() {
    return env("SAFARIPLUG_HOTEL_HOTELBEDS_BASE_URL") || (this.environment === "production" ? PROD_BASE : TEST_BASE);
  }

  private get apiKey() { return env("SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY"); }
  private get secret() { return env("SAFARIPLUG_HOTEL_HOTELBEDS_SECRET"); }
  private get certificate() { return decodePem(env("SAFARIPLUG_HOTEL_HOTELBEDS_CERT")); }
  private get privateKey() { return decodePem(env("SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY")); }

  private configured() {
    return Boolean(this.apiKey && this.secret && this.certificate && this.privateKey);
  }

  private signature() {
    if (!this.apiKey || !this.secret) throw new Error("Hotelbeds API key and secret are not configured.");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    return createHash("sha256").update(`${this.apiKey}${this.secret}${timestamp}`).digest("hex");
  }

  private async request<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown; mtls?: boolean; timeoutMs?: number } = {}): Promise<T> {
    if (!this.apiKey || !this.secret) throw new Error("Hotelbeds API key and secret are not configured.");
    if (options.mtls && (!this.certificate || !this.privateKey)) {
      throw new Error("Hotelbeds mTLS certificate and private key are required for Hotel Booking API operations.");
    }

    const url = new URL(path, this.baseUrl);
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const signature = this.signature();

    return new Promise<T>((resolve, reject) => {
      const req = https.request(url, {
        method: options.method || (body ? "POST" : "GET"),
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "identity",
          "Content-Type": "application/json",
          "Api-key": this.apiKey!,
          "X-Signature": signature,
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        },
        cert: options.mtls ? this.certificate : undefined,
        key: options.mtls ? this.privateKey : undefined,
        rejectUnauthorized: true,
        timeout: options.timeoutMs || 30_000,
      }, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed: unknown = {};
          try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { error: { message: raw } }; }
          const status = response.statusCode || 500;
          if (status < 200 || status >= 300) {
            const candidate = parsed as { error?: { code?: unknown; message?: unknown } };
            reject(new Error(String(candidate.error?.message || candidate.error?.code || `Hotelbeds returned HTTP ${status}.`)));
            return;
          }
          resolve(parsed as T);
        });
      });
      req.on("timeout", () => req.destroy(new Error("Hotelbeds request timed out.")));
      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    });
  }

  capabilities(): HotelCapabilities {
    const configured = this.configured();
    return { search: configured, availability: configured, quote: false, hold: false, confirm: false, cancel: false };
  }

  credentialsPresent() { return this.configured(); }
  contractImplemented() { return true; }
  status(): HotelProviderStatus { return this.configured() ? "configured" : "not_configured"; }

  async health(): Promise<HotelHealth> {
    const started = Date.now();
    if (!this.apiKey || !this.secret) {
      return { provider: this.key, status: "not_configured", configured: false, contract_implemented: true, reachable: false, authenticated: false, latency_ms: 0, last_success_at: null, last_error: "Hotelbeds API key and secret are not configured.", checked_at: new Date().toISOString() };
    }
    if (!this.certificate || !this.privateKey) {
      return { provider: this.key, status: "not_configured", configured: false, contract_implemented: true, reachable: false, authenticated: false, latency_ms: 0, last_success_at: null, last_error: "Hotelbeds mTLS certificate/private key are required before availability can be enabled.", checked_at: new Date().toISOString() };
    }
    try {
      await this.request("/hotel-api/1.0/status", { method: "GET", timeoutMs: 10_000 });
      return { provider: this.key, status: "healthy", configured: true, contract_implemented: true, reachable: true, authenticated: true, latency_ms: Date.now() - started, last_success_at: new Date().toISOString(), last_error: null, checked_at: new Date().toISOString() };
    } catch (error) {
      return { provider: this.key, status: "degraded", configured: true, contract_implemented: true, reachable: false, authenticated: false, latency_ms: Date.now() - started, last_success_at: null, last_error: error instanceof Error ? error.message : "Hotelbeds health check failed.", checked_at: new Date().toISOString() };
    }
  }

  async search(request: HotelSearchRequest): Promise<HotelResult<HotelSearchResponse>> {
    if (!this.configured()) {
      return { ok: false, error: hotelError("not_configured", "Hotelbeds requires API key, secret and mTLS certificate credentials.", false) };
    }

    const destinationCode = resolveDestinationCode(request.destination);
    if (!destinationCode) {
      return { ok: false, error: hotelError("bad_request", `Hotelbeds destination mapping is missing for: ${request.destination}.`, false) };
    }

    const adults = Math.max(1, request.adults ?? request.guests);
    const rooms = Math.max(1, request.rooms);
    if (adults < rooms) {
      return { ok: false, error: hotelError("bad_request", "Hotelbeds requires at least one adult per room.", false) };
    }
    const children = Math.max(0, request.children || 0);
    const occupancies = distributeAdults(adults, rooms).map((roomAdults, index) => ({
      rooms: 1,
      adults: roomAdults,
      children: index === 0 ? children : 0,
    }));

    try {
      const response = await this.request<HbAvailability>("/hotel-api/1.0/hotels", {
        method: "POST",
        mtls: true,
        body: {
          stay: { checkIn: request.check_in, checkOut: request.check_out },
          occupancies,
          destination: { code: destinationCode },
        },
      });

      const supplierCurrency = response.hotels?.currency || "EUR";
      const target = customerCurrency(request.currency);
      const results: HotelSearchResponse["results"] = [];

      for (const hotel of response.hotels?.hotels || []) {
        for (const room of hotel.rooms || []) {
          for (const rate of room.rates || []) {
            const net = Number(rate.net ?? rate.sellingRate);
            if (!rate.rateKey || !Number.isFinite(net)) continue;
            const converted = await convertCurrency(retail(net), supplierCurrency, target);
            const firstPolicy = rate.cancellationPolicies?.[0];
            results.push({
              provider: this.key,
              property_id: String(hotel.code ?? ""),
              property_name: hotel.name || "Hotelbeds hotel",
              room_id: room.code || null,
              rate_id: rate.rateKey,
              currency: converted.toCurrency,
              total: { amount: converted.amount, currency: converted.toCurrency },
              cancellation: firstPolicy
                ? `Cancellation fee ${supplierCurrency} ${Number(firstPolicy.amount || 0).toFixed(2)} from ${firstPolicy.from || "the supplier deadline"}`
                : "See Hotelbeds rate conditions before booking",
              availability: "available",
              source: "supplier",
              supplier_context: {
                rate_key: rate.rateKey,
                rate_type: rate.rateType || "BOOKABLE",
                destination_code: destinationCode,
                board_code: rate.boardCode || null,
                board_name: rate.boardName || null,
                category_code: hotel.categoryCode || null,
                category_name: hotel.categoryName || null,
                destination_name: hotel.destinationName || null,
                room_name: room.name || null,
                supplier_currency: supplierCurrency,
                markup_percent: markupPercent(),
              },
            });
          }
        }
      }

      return { ok: true, data: { provider: this.key, results } };
    } catch (error) {
      return { ok: false, error: hotelError("provider_error", error instanceof Error ? error.message : "Hotelbeds availability failed.", false) };
    }
  }

  checkRate(rateKey: string) {
    return this.request<HbAvailability>("/hotel-api/1.0/checkrates", {
      method: "POST",
      mtls: true,
      body: { rooms: [{ rateKey }] },
    });
  }

  book(input: {
    holder: { name: string; surname: string };
    rooms: Array<{ rateKey: string; paxes: Array<{ roomId: number; type: "AD" | "CH"; name: string; surname: string; age?: number }> }>;
    clientReference: string;
    remark?: string;
    tolerance?: number;
  }) {
    return this.request<HbBooking>("/hotel-api/1.0/bookings", {
      method: "POST",
      mtls: true,
      timeoutMs: 65_000,
      body: input,
    });
  }

  async availability(_request: HotelAvailabilityRequest): Promise<HotelResult<HotelAvailabilityResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Use Hotelbeds availability search and rateKey workflow.", false) };
  }

  async quote(_request: HotelQuoteRequest): Promise<HotelResult<HotelQuoteResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Use Hotelbeds CheckRate for RECHECK rates.", false) };
  }

  async hold(_request: HotelHoldRequest): Promise<HotelResult<HotelHoldResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Hotelbeds does not use SafariPlug's generic hold contract.", false) };
  }

  async confirm(_request: HotelConfirmRequest): Promise<HotelResult<HotelConfirmResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Use the guarded Hotelbeds booking route with a BOOKABLE rateKey.", false) };
  }

  async cancel(_request: HotelCancelRequest): Promise<HotelResult<HotelCancelResponse>> {
    return { ok: false, error: hotelError("capability_unsupported", "Hotelbeds cancellation management will be added after test booking certification.", false) };
  }
}
