export type PaymentProvider = "stripe" | "mpesa" | "paystack" | "flutterwave" | "manual";
export type PaymentIntentStatus = "requires_payment" | "processing" | "succeeded" | "failed" | "cancelled";

export type CreatePaymentIntentInput = {
  appointmentId: string;
  amount: number;
  currency: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  returnUrl?: string | null;
  idempotencyKey: string;
};

export type PaymentIntent = {
  id: string;
  provider: PaymentProvider;
  providerReference: string | null;
  appointmentId: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  checkoutUrl: string | null;
  clientSecret: string | null;
};

export interface PaymentAdapter {
  readonly provider: PaymentProvider;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent>;
  getPaymentStatus(providerReference: string): Promise<PaymentIntentStatus>;
}

export function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}
