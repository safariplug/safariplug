import { hotelError } from "./errors";
import { HOTEL_PROVIDER_NAMES, type HotelAdapter } from "./adapter";
import {
  NO_HOTEL_CAPABILITIES,
  type CircuitState,
  type HotelAvailabilityRequest,
  type HotelCancelRequest,
  type HotelConfirmRequest,
  type HotelHealth,
  type HotelHoldRequest,
  type HotelProviderKey,
  type HotelProviderStatus,
  type HotelQuoteRequest,
  type HotelSearchRequest,
} from "./types";

function credentialEnv(key: HotelProviderKey): {
  url: string | undefined;
  token: string | undefined;
} {
  const prefix = `SAFARIPLUG_HOTEL_${key.toUpperCase()}`;
  return {
    url: process.env[`${prefix}_BASE_URL`]?.trim() || undefined,
    token: process.env[`${prefix}_API_KEY`]?.trim() || undefined,
  };
}

export class UnavailableHotelAdapter implements HotelAdapter {
  readonly circuit: CircuitState = "closed";
  readonly key: HotelProviderKey;
  readonly name: string;

  constructor(key: HotelProviderKey, name?: string) {
    this.key = key;
    this.name = name ?? HOTEL_PROVIDER_NAMES[key];
  }

  capabilities() {
    return { ...NO_HOTEL_CAPABILITIES };
  }

  credentialsPresent(): boolean {
    const env = credentialEnv(this.key);
    return Boolean(env.url && env.token);
  }

  contractImplemented(): boolean {
    return false;
  }

  status(): HotelProviderStatus {
    if (this.credentialsPresent()) return "unavailable";
    return "not_configured";
  }

  reason(): string {
    if (this.credentialsPresent()) {
      return `${this.name} credentials are present but no implemented API contract exists. SafariPlug will not call the supplier.`;
    }
    return `${this.name} hotel inventory is not configured. No API contract or credentials are available.`;
  }

  async health(): Promise<HotelHealth> {
    return {
      provider: this.key,
      status: this.status(),
      configured: this.credentialsPresent(),
      contract_implemented: false,
      reachable: false,
      authenticated: null,
      latency_ms: null,
      last_success_at: null,
      last_error: this.reason(),
      checked_at: new Date().toISOString(),
    };
  }

  private fail<T>() {
    const code = this.credentialsPresent() ? "contract_required" : "not_configured";
    return {
      ok: false as const,
      error: hotelError(code, this.reason(), false),
    };
  }

  async search(_request: HotelSearchRequest) {
    return this.fail<never>();
  }
  async availability(_request: HotelAvailabilityRequest) {
    return this.fail<never>();
  }
  async quote(_request: HotelQuoteRequest) {
    return this.fail<never>();
  }
  async hold(_request: HotelHoldRequest) {
    return this.fail<never>();
  }
  async confirm(_request: HotelConfirmRequest) {
    return this.fail<never>();
  }
  async cancel(_request: HotelCancelRequest) {
    return this.fail<never>();
  }
}
