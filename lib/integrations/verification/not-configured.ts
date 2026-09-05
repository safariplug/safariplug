import {
  VERIFICATION_PROVIDER_NAMES,
  type VerificationAdapter,
} from "./adapter";
import {
  NO_VERIFICATION_CAPABILITIES,
  type VerificationHealth,
  type VerificationProviderKey,
  type VerificationProviderStatus,
} from "./types";

function credentialEnv(key: VerificationProviderKey) {
  const prefix = `SAFARIPLUG_VERIFY_${key.toUpperCase()}`;
  return {
    url: process.env[`${prefix}_BASE_URL`]?.trim() || undefined,
    token: process.env[`${prefix}_API_KEY`]?.trim() || undefined,
  };
}

export class UnavailableVerificationAdapter implements VerificationAdapter {
  readonly key: VerificationProviderKey;
  readonly name: string;

  constructor(key: VerificationProviderKey) {
    this.key = key;
    this.name = VERIFICATION_PROVIDER_NAMES[key];
  }

  capabilities() {
    return { ...NO_VERIFICATION_CAPABILITIES };
  }
  credentialsPresent() {
    const env = credentialEnv(this.key);
    return Boolean(env.url && env.token);
  }
  contractImplemented() {
    return false;
  }
  status(): VerificationProviderStatus {
    if (this.key === "human_review") return "configured";
    return this.credentialsPresent() ? "unavailable" : "not_configured";
  }
  reason() {
    if (this.key === "human_review") {
      return "Human review is available to admins. It is not an identity, liveness, or KYC provider.";
    }
    if (this.credentialsPresent()) {
      return `${this.name} credentials are present but no contract is implemented. SafariPlug will not claim verification.`;
    }
    return `${this.name} is not configured.`;
  }
  async health(): Promise<VerificationHealth> {
    return {
      provider: this.key,
      status: this.status(),
      configured: this.key === "human_review" || this.credentialsPresent(),
      contract_implemented: false,
      last_error: this.reason(),
      checked_at: new Date().toISOString(),
    };
  }
  async requestExternalCheck(_caseId: string) {
    return {
      ok: false as const,
      error: {
        code: "not_configured" as const,
        message: "verification_not_configured",
      },
    };
  }
}
