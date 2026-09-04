import type {
  CircuitState,
  TransferAvailabilityRequest,
  TransferAvailabilityResponse,
  TransferCancelRequest,
  TransferCancelResponse,
  TransferCapabilities,
  TransferConfirmRequest,
  TransferConfirmResponse,
  TransferHealth,
  TransferHoldRequest,
  TransferHoldResponse,
  TransferProviderKey,
  TransferProviderStatus,
  TransferQuoteRequest,
  TransferQuoteResponse,
  TransferResult,
  TransferSearchRequest,
  TransferSearchResponse,
} from "./types";

export interface TransferAdapter {
  readonly key: TransferProviderKey;
  readonly name: string;
  readonly circuit: CircuitState;
  capabilities(): TransferCapabilities;
  status(): TransferProviderStatus;
  credentialsPresent(): boolean;
  contractImplemented(): boolean;
  health(): Promise<TransferHealth>;
  search(
    request: TransferSearchRequest
  ): Promise<TransferResult<TransferSearchResponse>>;
  availability(
    request: TransferAvailabilityRequest
  ): Promise<TransferResult<TransferAvailabilityResponse>>;
  quote(
    request: TransferQuoteRequest
  ): Promise<TransferResult<TransferQuoteResponse>>;
  hold(request: TransferHoldRequest): Promise<TransferResult<TransferHoldResponse>>;
  confirm(
    request: TransferConfirmRequest
  ): Promise<TransferResult<TransferConfirmResponse>>;
  cancel(
    request: TransferCancelRequest
  ): Promise<TransferResult<TransferCancelResponse>>;
}

export const TRANSFER_PROVIDER_NAMES: Record<TransferProviderKey, string> = {
  aurelian: "Aurelian Hospitality",
  hotel_direct: "Hotel / operator direct",
  airport_operator: "Airport transfer operator",
  transport_company: "Transport company",
  tour_operator: "Tour operator",
  independent_driver: "Independent driver",
  safariplug_driver: "SafariPlug driver marketplace",
  external_supplier: "External transfer API",
};
