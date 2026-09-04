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
  HotelProviderKey,
  HotelProviderStatus,
  HotelQuoteRequest,
  HotelQuoteResponse,
  HotelResult,
  HotelSearchRequest,
  HotelSearchResponse,
} from "./types";

export interface HotelAdapter {
  readonly key: HotelProviderKey;
  readonly name: string;
  readonly circuit: CircuitState;
  capabilities(): HotelCapabilities;
  status(): HotelProviderStatus;
  credentialsPresent(): boolean;
  contractImplemented(): boolean;
  health(): Promise<HotelHealth>;
  search(request: HotelSearchRequest): Promise<HotelResult<HotelSearchResponse>>;
  availability(
    request: HotelAvailabilityRequest
  ): Promise<HotelResult<HotelAvailabilityResponse>>;
  quote(request: HotelQuoteRequest): Promise<HotelResult<HotelQuoteResponse>>;
  hold(request: HotelHoldRequest): Promise<HotelResult<HotelHoldResponse>>;
  confirm(
    request: HotelConfirmRequest
  ): Promise<HotelResult<HotelConfirmResponse>>;
  cancel(
    request: HotelCancelRequest
  ): Promise<HotelResult<HotelCancelResponse>>;
}

export const HOTEL_PROVIDER_NAMES: Record<HotelProviderKey, string> = {
  booking: "Booking.com",
  beds24: "Beds24",
  hotelbeds: "Hotelbeds",
  amadeus: "Amadeus",
  expedia: "Expedia",
  agoda: "Agoda",
  ratehawk: "RateHawk",
  siteminder: "SiteMinder",
  cloudbeds: "Cloudbeds",
  mews: "Mews",
  guesty: "Guesty",
  hostaway: "Hostaway",
  direct: "Direct hotel API",
  aurelian: "Aurelian Hospitality",
};
