import { UnavailableHotelAdapter } from "./not-configured";
import { HOTEL_PROVIDER_NAMES, type HotelAdapter } from "./adapter";
import {
  HOTEL_PROVIDER_KEYS,
  type HotelProviderDescriptor,
  type HotelProviderKey,
} from "./types";

const factories = new Map<HotelProviderKey, () => HotelAdapter>();

export function registerHotelAdapter(
  key: HotelProviderKey,
  factory: () => HotelAdapter
): void {
  factories.set(key, factory);
}

export function unregisterHotelAdapter(key: HotelProviderKey): void {
  factories.delete(key);
}

export function getHotelAdapter(key: HotelProviderKey): HotelAdapter {
  const factory = factories.get(key);
  if (factory) return factory();
  return new UnavailableHotelAdapter(key);
}

export function listHotelAdapters(): HotelAdapter[] {
  return HOTEL_PROVIDER_KEYS.map((key) => getHotelAdapter(key));
}

export function liveHotelAdapters(): HotelAdapter[] {
  return listHotelAdapters().filter((adapter) => {
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

export async function describeHotelProviders(): Promise<
  HotelProviderDescriptor[]
> {
  const adapters = listHotelAdapters();
  return Promise.all(
    adapters.map(async (adapter) => {
      const health = await adapter.health();
      const unimplemented = adapter instanceof UnavailableHotelAdapter;
      return {
        key: adapter.key,
        name: adapter.name || HOTEL_PROVIDER_NAMES[adapter.key],
        status: adapter.status(),
        configured: adapter.credentialsPresent(),
        contract_implemented: adapter.contractImplemented(),
        capabilities: adapter.capabilities(),
        reason: unimplemented
          ? adapter.reason()
          : health.last_error ||
            (adapter.contractImplemented()
              ? `${adapter.name} adapter is registered.`
              : `${adapter.name} has no live contract.`),
        health,
      };
    })
  );
}
