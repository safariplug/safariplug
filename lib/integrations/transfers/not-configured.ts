import { transferError } from "./errors";
import { TRANSFER_PROVIDER_NAMES, type TransferAdapter } from "./adapter";
import {
  NO_TRANSFER_CAPABILITIES,
  type CircuitState,
  type TransferAvailabilityRequest,
  type TransferCancelRequest,
  type TransferConfirmRequest,
  type TransferHealth,
  type TransferHoldRequest,
  type TransferProviderKey,
  type TransferProviderStatus,
  type TransferQuoteRequest,
  type TransferSearchRequest,
} from "./types";

function credentialEnv(key: TransferProviderKey) {
  const prefix = `SAFARIPLUG_TRANSFER_${key.toUpperCase()}`;
  return {
    url: process.env[`${prefix}_BASE_URL`]?.trim() || undefined,
    token: process.env[`${prefix}_API_KEY`]?.trim() || undefined,
  };
}

export class UnavailableTransferAdapter implements TransferAdapter {
  readonly circuit: CircuitState = "closed";
  readonly key: TransferProviderKey;
  readonly name: string;

  constructor(key: TransferProviderKey, name?: string) {
    this.key = key;
    this.name = name ?? TRANSFER_PROVIDER_NAMES[key];
  }

  capabilities() {
    return { ...NO_TRANSFER_CAPABILITIES };
  }

  credentialsPresent(): boolean {
    const env = credentialEnv(this.key);
    return Boolean(env.url && env.token);
  }

  contractImplemented(): boolean {
    return false;
  }

  status(): TransferProviderStatus {
    return this.credentialsPresent() ? "unavailable" : "not_configured";
  }

  reason(): string {
    if (this.credentialsPresent()) {
      return `${this.name} credentials are present but no implemented transfer contract exists. SafariPlug will not call the supplier.`;
    }
    return `${this.name} transfer inventory is not configured. No API contract or credentials are available.`;
  }

  async health(): Promise<TransferHealth> {
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

  private fail() {
    const code = this.credentialsPresent() ? "contract_required" : "not_configured";
    return { ok: false as const, error: transferError(code, this.reason()) };
  }

  async search(_request: TransferSearchRequest) {
    return this.fail();
  }
  async availability(_request: TransferAvailabilityRequest) {
    return this.fail();
  }
  async quote(_request: TransferQuoteRequest) {
    return this.fail();
  }
  async hold(_request: TransferHoldRequest) {
    return this.fail();
  }
  async confirm(_request: TransferConfirmRequest) {
    return this.fail();
  }
  async cancel(_request: TransferCancelRequest) {
    return this.fail();
  }
}
