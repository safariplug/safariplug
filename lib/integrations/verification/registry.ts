import { VERIFICATION_PROVIDER_NAMES, type VerificationAdapter } from "./adapter";
import { UnavailableVerificationAdapter } from "./not-configured";
import type {
  VerificationProviderDescriptor,
  VerificationProviderKey,
} from "./types";

const KEYS: VerificationProviderKey[] = [
  "human_review",
  "identity_provider",
  "liveness_provider",
  "document_provider",
  "background_provider",
];

const factories = new Map<VerificationProviderKey, () => VerificationAdapter>();

export function registerVerificationAdapter(
  key: VerificationProviderKey,
  factory: () => VerificationAdapter
) {
  factories.set(key, factory);
}

export function unregisterVerificationAdapter(key: VerificationProviderKey) {
  factories.delete(key);
}

export function getVerificationAdapter(
  key: VerificationProviderKey
): VerificationAdapter {
  return factories.get(key)?.() ?? new UnavailableVerificationAdapter(key);
}

export function liveVerificationAdapters(): VerificationAdapter[] {
  return KEYS.map(getVerificationAdapter).filter(
    (adapter) =>
      adapter.key !== "human_review" &&
      adapter.contractImplemented() &&
      adapter.credentialsPresent() &&
      (adapter.status() === "healthy" ||
        adapter.status() === "configured" ||
        adapter.status() === "degraded")
  );
}

export async function describeVerificationProviders(): Promise<
  VerificationProviderDescriptor[]
> {
  return Promise.all(
    KEYS.map(async (key) => {
      const adapter = getVerificationAdapter(key);
      const health = await adapter.health();
      const unimplemented = !adapter.contractImplemented();
      return {
        key,
        name: adapter.name || VERIFICATION_PROVIDER_NAMES[key],
        status: adapter.status(),
        configured: adapter.credentialsPresent() || key === "human_review",
        contract_implemented: adapter.contractImplemented(),
        capabilities: adapter.capabilities(),
        reason: unimplemented
          ? adapter instanceof UnavailableVerificationAdapter
            ? adapter.reason()
            : health.last_error || `${adapter.name} has no live contract.`
          : `${adapter.name} adapter is registered.`,
        health,
      };
    })
  );
}
