import type { PaymentAdapter, PaymentProvider } from "./types";
import { MpesaPaymentAdapter } from "./mpesa";
import { StripePaymentAdapter } from "./stripe";

const adapters = new Map<PaymentProvider, PaymentAdapter>();

if (process.env.STRIPE_SECRET_KEY?.trim()) adapters.set("stripe", new StripePaymentAdapter());
if (
  process.env.MPESA_CONSUMER_KEY?.trim() &&
  process.env.MPESA_CONSUMER_SECRET?.trim() &&
  process.env.MPESA_SHORTCODE?.trim() &&
  process.env.MPESA_PASSKEY?.trim() &&
  process.env.MPESA_CALLBACK_URL?.trim()
) adapters.set("mpesa", new MpesaPaymentAdapter());

export function registerPaymentAdapter(adapter: PaymentAdapter) {
  adapters.set(adapter.provider, adapter);
}

export function getPaymentAdapter(provider: PaymentProvider): PaymentAdapter | null {
  return adapters.get(provider) ?? null;
}

export function getConfiguredPaymentProviders(): PaymentProvider[] {
  return [...adapters.keys()];
}
