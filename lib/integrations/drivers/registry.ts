import { DRIVER_PROVIDER_NAMES, type DriverAdapter } from "./adapter";
import { UnavailableDriverAdapter } from "./not-configured";
import {
  DRIVER_PROVIDER_TYPES,
  type DriverProviderDescriptor,
  type DriverProviderType,
} from "./types";

const factories = new Map<DriverProviderType, () => DriverAdapter>();

export function registerDriverAdapter(
  key: DriverProviderType,
  factory: () => DriverAdapter
): void {
  factories.set(key, factory);
}

export function unregisterDriverAdapter(key: DriverProviderType): void {
  factories.delete(key);
}

export function getDriverAdapter(key: DriverProviderType): DriverAdapter {
  const factory = factories.get(key);
  if (factory) return factory();
  return new UnavailableDriverAdapter(key);
}

export function listDriverAdapters(): DriverAdapter[] {
  return DRIVER_PROVIDER_TYPES.map((key) => getDriverAdapter(key));
}

export function liveDriverAdapters(): DriverAdapter[] {
  return listDriverAdapters().filter(
    (adapter) =>
      adapter.contractImplemented() &&
      adapter.credentialsPresent() &&
      (adapter.status() === "healthy" ||
        adapter.status() === "configured" ||
        adapter.status() === "degraded")
  );
}

export async function describeDriverProviders(): Promise<
  DriverProviderDescriptor[]
> {
  return Promise.all(
    listDriverAdapters().map(async (adapter) => {
      const health = await adapter.health();
      const unimplemented = adapter instanceof UnavailableDriverAdapter;
      return {
        key: adapter.key,
        name: adapter.name || DRIVER_PROVIDER_NAMES[adapter.key],
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
