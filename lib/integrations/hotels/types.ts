import type { PriceQuote } from "@/lib/services/pricing";

export const HOTEL_PROVIDER_KEYS = [
  "booking",
  "beds24",
  "hotelbeds",
  "amadeus",
  "expedia",
  "agoda",
  "ratehawk",
  "siteminder",
  "cloudbeds",
  "mews",
  "guesty",
  "hostaway",
  "direct",
  "aurelian",
] as const;

export type HotelProviderKey = (typeof HOTEL_PROVIDER_KEYS)[number];

export type HotelProviderStatus =
  | "unavailable"
  | "not_configured"
  | "configured"
  | "healthy"
  | "degraded"
  | "disabled";

export type HotelCapabilities = {
  search: boolean;
  availability: boolean;
  quote: boolean;
  hold: boolean;
  confirm: boolean;
  cancel: boolean;
};

export const NO_HOTEL_CAPABILITIES: HotelCapabilities = {
  search: false,
  availability: false,
  quote: false,
  hold: false,
  confirm: false,
  cancel: false,
};

export type HotelErrorCode =
  | "not_configured"
  | "unavailable"
  | "timeout"
  | "provider_error"
  | "contract_required"
  | "bad_request"
  | "idempotency_conflict"
  | "capability_unsupported";

export type HotelError = {
  code: HotelErrorCode;
  message: string;
  retryable: boolean;
};

export type HotelResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: HotelError };

export type HotelHealth = {
  provider: HotelProviderKey;
  status: HotelProviderStatus;
  configured: boolean;
  contract_implemented: boolean;
  reachable: boolean;
  authenticated: boolean | null;
  latency_ms: number | null;
  last_success_at: string | null;
  last_error: string | null;
  checked_at: string;
};

export type HotelSearchRequest = {
  destination: string;
  check_in: string;
  check_out: string;
  guests: number;
  rooms: number;
  currency?: string;
  adults?: number;
  children?: number;
};

export type HotelMoney = {
  amount: number;
  currency: string;
};

export type HotelSearchResult = {
  provider: HotelProviderKey;
  property_id: string;
  property_name: string;
  room_id: string | null;
  rate_id: string | null;
  currency: string;
  total: HotelMoney | null;
  cancellation: string | null;
  availability: "available" | "unavailable" | "unknown";
  source: "supplier";
};

export type HotelSearchResponse = {
  results: HotelSearchResult[];
  provider: HotelProviderKey;
};

export type HotelAvailabilityRequest = HotelSearchRequest & {
  property_id: string;
};

export type HotelAvailabilityResponse = {
  provider: HotelProviderKey;
  property_id: string;
  available: boolean;
  rooms: Array<{
    room_id: string;
    rate_id: string | null;
    remaining: number | null;
    total: HotelMoney | null;
  }>;
  source: "supplier";
};

export type HotelQuoteRequest = {
  provider: HotelProviderKey;
  property_id: string;
  room_id: string;
  rate_id: string | null;
  check_in: string;
  check_out: string;
  guests: number;
  rooms: number;
  currency?: string;
  supplier_amount: number;
  supplier_currency: string;
  markup_amount?: number;
  commission_amount?: number;
  tax_amount?: number;
  fee_amount?: number;
};

export type HotelQuoteResponse = {
  provider: HotelProviderKey;
  property_id: string;
  room_id: string;
  rate_id: string | null;
  quote: PriceQuote;
};

export type HotelHoldRequest = {
  quote: HotelQuoteResponse;
  idempotency_key: string;
  traveler_id: string;
};

export type HotelHoldResponse = {
  hold_id: string;
  expires_at: string;
};

export type HotelConfirmRequest = {
  hold_id: string;
  idempotency_key: string;
  traveler_id: string;
};

export type HotelConfirmResponse = {
  booking_reference: string;
  status: "booked";
};

export type HotelCancelRequest = {
  booking_reference: string;
  idempotency_key: string;
};

export type HotelCancelResponse = {
  booking_reference: string;
  status: "cancelled";
};

export type HotelProviderDescriptor = {
  key: HotelProviderKey;
  name: string;
  status: HotelProviderStatus;
  configured: boolean;
  contract_implemented: boolean;
  capabilities: HotelCapabilities;
  reason: string;
  health: HotelHealth;
};

export type CircuitState = "closed" | "open" | "half_open";
