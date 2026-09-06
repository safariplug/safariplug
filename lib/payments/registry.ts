import type { PaymentAdapter, PaymentProvider } from "./types";

const adapters = new Map<PaymentProvider, PaymentAdapter>();

export function registerPaymentAdapter(adapter: PaymentAdapter) {
  adapters.set(adapter.provider, adapter);
}

export function getPaymentAdapter(provider: PaymentProvider): PaymentAdapter | null {
  return adapters.get(provider) ?? null;
}

export function getConfiguredPaymentProviders(): PaymentProvider[] {
  return [...adapters.keys()];
}
