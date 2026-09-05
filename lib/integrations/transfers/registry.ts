import { TRANSFER_PROVIDER_NAMES, type TransferAdapter } from "./adapter";
import { UnavailableTransferAdapter } from "./not-configured";
import {
  TRANSFER_PROVIDER_KEYS,
  type TransferProviderDescriptor,
  type TransferProviderKey,
} from "./types";

const factories = new Map<TransferProviderKey, () => TransferAdapter>();

export function registerTransferAdapter(
  key: TransferProviderKey,
  factory: () => TransferAdapter
): void {
  factories.set(key, factory);
}

export function unregisterTransferAdapter(key: TransferProviderKey): void {
  factories.delete(key);
}

export function getTransferAdapter(key: TransferProviderKey): TransferAdapter {
  const factory = factories.get(key);
  if (factory) return factory();
  return new UnavailableTransferAdapter(key);
}

export function listTransferAdapters(): TransferAdapter[] {
  return TRANSFER_PROVIDER_KEYS.map((key) => getTransferAdapter(key));
}

export function liveTransferAdapters(): TransferAdapter[] {
  return listTransferAdapters().filter((adapter) => {
    const capabilities = adapter.capabilities();
    return (
      adapter.contractImplemented() &&
      adapter.credentialsPresent() &&
      (adapter.status() === "healthy" ||
        adapter.status() === "configured" ||
        adapter.status() === "degraded") &&
      (capabilities.search || capabilities.availability)
    );
  });
}

export async function describeTransferProviders(): Promise<
  TransferProviderDescriptor[]
> {
  return Promise.all(
    listTransferAdapters().map(async (adapter) => {
      const health = await adapter.health();
      const unimplemented = adapter instanceof UnavailableTransferAdapter;
      return {
        key: adapter.key,
        name: adapter.name || TRANSFER_PROVIDER_NAMES[adapter.key],
        status: adapter.status(),
        configured: adapter.credentialsPresent(),
        contract_implemented: adapter.contractImplemented(),
        capabilities: adapter.capabilities(),
        reason: unimplemented
          ? adapter.reason()
          : health.last_error || `${adapter.name} adapter is registered.`,
        health,
      };
    })
  );
}
