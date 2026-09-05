export type { HotelAdapter } from "./adapter";
export { HOTEL_PROVIDER_NAMES } from "./adapter";
export {
  HotelAdapterError,
  hotelError,
  retryIfSafe,
  withTimeout,
} from "./errors";
export { hotelConnectivitySnapshot, hotelProviderHealth } from "./health";
export { UnavailableHotelAdapter } from "./not-configured";
export {
  describeHotelProviders,
  getHotelAdapter,
  listHotelAdapters,
  liveHotelAdapters,
  registerHotelAdapter,
  unregisterHotelAdapter,
} from "./registry";
export * from "./types";
