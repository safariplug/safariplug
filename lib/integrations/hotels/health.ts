import { describeHotelProviders, getHotelAdapter } from "./registry";
import type { HotelHealth, HotelProviderKey } from "./types";

/** Local metadata only. Does not call supplier APIs for unimplemented adapters. */
export async function hotelProviderHealth(
  key: HotelProviderKey
): Promise<HotelHealth> {
  return getHotelAdapter(key).health();
}

export async function hotelConnectivitySnapshot() {
  const providers = await describeHotelProviders();
  const live = providers.filter((row) => row.contract_implemented && row.configured);
  return {
    live_count: live.length,
    providers,
  };
}
