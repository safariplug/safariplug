import { DRIVER_PROVIDER_NAMES, type DriverAdapter } from "./adapter";
import {
  NO_DRIVER_CAPABILITIES,
  type DriverActor,
  type DriverHealth,
  type DriverProviderStatus,
  type DriverProviderType,
  type TransferFulfillmentRequest,
} from "./types";

function credentialEnv(key: DriverProviderType) {
  const prefix = `SAFARIPLUG_DRIVER_${key.toUpperCase()}`;
  return {
    url: process.env[`${prefix}_BASE_URL`]?.trim() || undefined,
    token: process.env[`${prefix}_API_KEY`]?.trim() || undefined,
  };
}

export class UnavailableDriverAdapter implements DriverAdapter {
  readonly key: DriverProviderType;
  readonly name: string;

  constructor(key: DriverProviderType, name?: string) {
    this.key = key;
    this.name = name ?? DRIVER_PROVIDER_NAMES[key];
  }

  capabilities() {
    return { ...NO_DRIVER_CAPABILITIES };
  }

  credentialsPresent(): boolean {
    const env = credentialEnv(this.key);
    return Boolean(env.url && env.token);
  }

  contractImplemented(): boolean {
    return false;
  }

  status(): DriverProviderStatus {
    return this.credentialsPresent() ? "unavailable" : "not_configured";
  }

  reason(): string {
    if (this.credentialsPresent()) {
      return `${this.name} credentials are present but no driver contract is implemented. SafariPlug will not list or assign drivers.`;
    }
    return `${this.name} is not configured. No driver API contract or credentials exist.`;
  }

  async health(): Promise<DriverHealth> {
    return {
      provider: this.key,
      status: this.status(),
      configured: this.credentialsPresent(),
      contract_implemented: false,
      reachable: false,
      last_error: this.reason(),
      checked_at: new Date().toISOString(),
    };
  }

  private fail() {
    return {
      ok: false as const,
      error: {
        code: this.credentialsPresent() ? ("contract_required" as const) : ("not_configured" as const),
        message: this.reason(),
      },
    };
  }

  async listDrivers() {
    return this.fail();
  }
  async getDriver(_id: string) {
    return this.fail();
  }
  async availability(_driverId: string, _onDate: string) {
    return this.fail();
  }
  async assign(
    _request: TransferFulfillmentRequest,
    _driverId: string,
    _actor: DriverActor
  ) {
    return this.fail();
  }
  async unassign(_assignmentId: string, _actor: DriverActor) {
    return this.fail();
  }
}
