import type {
  VerificationAdapterCapabilities,
  VerificationHealth,
  VerificationProviderKey,
  VerificationProviderStatus,
  VerificationResult,
} from "./types";

export interface VerificationAdapter {
  readonly key: VerificationProviderKey;
  readonly name: string;
  capabilities(): VerificationAdapterCapabilities;
  status(): VerificationProviderStatus;
  credentialsPresent(): boolean;
  contractImplemented(): boolean;
  health(): Promise<VerificationHealth>;
  requestExternalCheck(
    caseId: string
  ): Promise<VerificationResult<{ external_id: string }>>;
}

export const VERIFICATION_PROVIDER_NAMES: Record<
  VerificationProviderKey,
  string
> = {
  human_review: "SafariPlug human review",
  identity_provider: "Identity verification provider",
  liveness_provider: "Liveness provider",
  document_provider: "Document verification provider",
  background_provider: "Background / safety provider",
};
