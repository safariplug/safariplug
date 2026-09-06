import type { PaymentAdapter, PaymentProvider } from "./types";
import { StripePaymentAdapter } from "./stripe";

const adapters = new Map<PaymentProvider, PaymentAdapter>();

export function registerPaymentAdapter(adapter: PaymentAdapter) {
  adapters.set(adapter.provider, adapter);
}

if (process.env.STRIPE_SECRET_KEY?.trim()) {
  registerPaymentAdapter(new StripePaymentAdapter());
}

export function getPaymentAdapter(provider: PaymentProvider): PaymentAdapter | null {
  return adapters.get(provider) ?? null;
}

export function getConfiguredPaymentProviders(): PaymentProvider[] {
  return [...adapters.keys()];
}
