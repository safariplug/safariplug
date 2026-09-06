import type {
  CreatePaymentIntentInput,
  PaymentAdapter,
  PaymentIntent,
  PaymentIntentStatus,
} from "./types";

const STRIPE_API = "https://api.stripe.com/v1";

function secretKey() {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  if (!value) throw new Error("stripe_secret_key_not_configured");
  return value;
}

function asForm(data: Record<string, string | number | undefined | null>) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) form.set(key, String(value));
  }
  return form;
}

async function stripeRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.text();
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { parsed = body; }
  if (!response.ok) throw new Error(`stripe_api_error:${response.status}:${typeof parsed === "object" ? JSON.stringify(parsed) : String(parsed)}`);
  return parsed as Record<string, unknown>;
}

function status(value: unknown): PaymentIntentStatus {
  if (value === "complete" || value === "paid" || value === "succeeded") return "succeeded";
  if (value === "expired" || value === "canceled" || value === "cancelled") return "cancelled";
  if (value === "failed") return "failed";
  if (value === "processing") return "processing";
  return "requires_payment";
}

export class StripePaymentAdapter implements PaymentAdapter {
  readonly provider = "stripe" as const;

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://www.safariplug.com";
    const successUrl = input.returnUrl || `${siteUrl}/account/appointments?payment=success&appointment=${encodeURIComponent(input.appointmentId)}`;
    const cancelUrl = `${siteUrl}/account/appointments?payment=cancelled&appointment=${encodeURIComponent(input.appointmentId)}`;
    const cents = Math.round(input.amount * 100);
    if (!Number.isFinite(cents) || cents <= 0) throw new Error("invalid_payment_amount");

    const form = asForm({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: input.customerEmail ?? undefined,
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][product_data][name]": `SafariPlug service appointment ${input.appointmentId}`,
      "line_items[0][price_data][product_data][metadata][appointment_id]": input.appointmentId,
      "line_items[0][price_data][unit_amount]": cents,
      "line_items[0][quantity]": 1,
      "metadata[appointment_id]": input.appointmentId,
      "metadata[idempotency_key]": input.idempotencyKey,
    });

    const session = await stripeRequest("/checkout/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    return {
      id: String(session.id),
      provider: "stripe",
      providerReference: String(session.id),
      appointmentId: input.appointmentId,
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      status: status(session.payment_status),
      checkoutUrl: typeof session.url === "string" ? session.url : null,
      clientSecret: null,
    };
  }

  async getPaymentStatus(providerReference: string): Promise<PaymentIntentStatus> {
    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(providerReference)}`);
    return status(session.payment_status ?? session.status);
  }
}

export function stripeWebhookSecretConfigured() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

export async function verifyStripeWebhookSignature(payload: string, signature: string): Promise<boolean> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;

  const parts = signature.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = `${timestamp}.${payload}`;
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(signed));
  const expected = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return signatures.some((candidate) => candidate.length === expected.length && crypto.timingSafeEqual?.(Buffer.from(candidate), Buffer.from(expected)) ?? candidate === expected);
}
