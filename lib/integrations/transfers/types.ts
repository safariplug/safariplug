import type { PriceQuote } from "@/lib/services/pricing";

export const TRANSFER_PROVIDER_KEYS = [
  "aurelian",
  "hotel_direct",
  "airport_operator",
  "transport_company",
  "tour_operator",
  "independent_driver",
  "safariplug_driver",
  "external_supplier",
] as const;

export type TransferProviderKey = (typeof TRANSFER_PROVIDER_KEYS)[number];

export type TransferProviderStatus =
  | "unavailable"
  | "not_configured"
  | "configured"
  | "healthy"
  | "degraded"
  | "disabled";

export type TransferCapabilities = {
  search: boolean;
  availability: boolean;
  quote: boolean;
  hold: boolean;
  confirm: boolean;
  cancel: boolean;
};

export const NO_TRANSFER_CAPABILITIES: TransferCapabilities = {
  search: false,
  availability: false,
  quote: false,
  hold: false,
  confirm: false,
  cancel: false,
};

export type TransferErrorCode =
  | "not_configured"
  | "unavailable"
  | "timeout"
  | "provider_error"
  | "contract_required"
  | "bad_request"
  | "idempotency_conflict"
  | "capability_unsupported";

export type TransferError = {
  code: TransferErrorCode;
  message: string;
  retryable: boolean;
};

export type TransferResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: TransferError };

export type TransferLocationKind =
  | "airport"
  | "hotel"
  | "attraction"
  | "address"
  | "city"
  | "coordinates";

export type TransferLocation = {
  kind: TransferLocationKind;
  name?: string;
  city?: string;
  place_id?: string;
  airport_code?: string;
  hotel_property_id?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

export type TransferTripType = "one_way" | "round_trip";
export type TransferServiceMode = "private" | "shared" | "scheduled" | "on_demand";

export type TransferSearchRequest = {
  pickup: TransferLocation;
  dropoff: TransferLocation;
  pickup_date: string;
  pickup_time?: string;
  timezone?: string;
  adults: number;
  children: number;
  infants: number;
  luggage: number;
  trip_type: TransferTripType;
  vehicle_category?: string;
  currency?: string;
};

export type TransferVehicle = {
  category: string | null;
  name: string | null;
  passenger_capacity: number | null;
  luggage_capacity: number | null;
  accessibility: boolean | null;
  service_mode: TransferServiceMode | null;
};

export type TransferMoney = { amount: number; currency: string };

export type TransferSearchResult = {
  provider: TransferProviderKey;
  transfer_id: string;
  vehicle: TransferVehicle;
  duration_minutes: number | null;
  distance_km: number | null;
  cancellation: string | null;
  currency: string | null;
  total: TransferMoney | null;
  availability: "available" | "unavailable" | "unknown";
  source: "supplier";
};

export type TransferSearchResponse = {
  provider: TransferProviderKey;
  results: TransferSearchResult[];
};

export type TransferAvailabilityRequest = TransferSearchRequest & {
  transfer_id: string;
};

export type TransferAvailabilityResponse = {
  provider: TransferProviderKey;
  transfer_id: string;
  available: boolean;
  remaining: number | null;
  source: "supplier";
};

export type TransferQuoteRequest = {
  provider: TransferProviderKey;
  transfer_id: string;
  pickup: TransferLocation;
  dropoff: TransferLocation;
  pickup_date: string;
  pickup_time?: string;
  adults: number;
  children: number;
  infants: number;
  luggage: number;
  supplier_amount: number;
  supplier_currency: string;
  markup_amount?: number;
  commission_amount?: number;
  tax_amount?: number;
  fee_amount?: number;
  currency?: string;
};

export type TransferQuoteResponse = {
  provider: TransferProviderKey;
  transfer_id: string;
  quote: PriceQuote;
};

export type TransferHoldRequest = {
  quote: TransferQuoteResponse;
  idempotency_key: string;
  traveler_id: string;
};

export type TransferHoldResponse = { hold_id: string; expires_at: string };

export type TransferConfirmRequest = {
  hold_id: string;
  idempotency_key: string;
  traveler_id: string;
};

export type TransferConfirmResponse = {
  booking_reference: string;
  status: "booked";
};

export type TransferCancelRequest = {
  booking_reference: string;
  idempotency_key: string;
};

export type TransferCancelResponse = {
  booking_reference: string;
  status: "cancelled";
};

export type TransferHealth = {
  provider: TransferProviderKey;
  status: TransferProviderStatus;
  configured: boolean;
  contract_implemented: boolean;
  reachable: boolean;
  authenticated: boolean | null;
  latency_ms: number | null;
  last_success_at: string | null;
  last_error: string | null;
  checked_at: string;
};

export type TransferProviderDescriptor = {
  key: TransferProviderKey;
  name: string;
  status: TransferProviderStatus;
  configured: boolean;
  contract_implemented: boolean;
  capabilities: TransferCapabilities;
  reason: string;
  health: TransferHealth;
};

export type CircuitState = "closed" | "open" | "half_open";
