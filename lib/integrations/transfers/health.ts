import { describeTransferProviders, getTransferAdapter } from "./registry";
import type { TransferHealth, TransferProviderKey } from "./types";

export async function transferProviderHealth(
  key: TransferProviderKey
): Promise<TransferHealth> {
  return getTransferAdapter(key).health();
}

export async function transferConnectivitySnapshot() {
  const providers = await describeTransferProviders();
  return {
    live_count: providers.filter(
      (row) => row.contract_implemented && row.configured
    ).length,
    providers,
  };
}
