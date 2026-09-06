import type { CreatePaymentIntentInput, PaymentAdapter, PaymentIntent, PaymentIntentStatus } from "./types";

function config() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET?.trim();
  const shortCode = process.env.MPESA_SHORTCODE?.trim();
  const passKey = process.env.MPESA_PASSKEY?.trim();
  const callbackUrl = process.env.MPESA_CALLBACK_URL?.trim();
  if (!consumerKey || !consumerSecret || !shortCode || !passKey || !callbackUrl) {
    throw new Error("mpesa_credentials_not_configured");
  }
  return { consumerKey, consumerSecret, shortCode, passKey, callbackUrl };
}

function baseUrl() {
  return (process.env.MPESA_BASE_URL?.trim() || "https://sandbox.safaricom.co.ke").replace(/\/$/, "");
}

function normalizePhone(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^2547\d{8}$/.test(digits)) return digits;
  if (/^07\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^01\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits)) return `254${digits}`;
  if (/^1\d{8}$/.test(digits)) return `254${digits}`;
  throw new Error("invalid_mpesa_phone");
}

async function accessToken() {
  const { consumerKey, consumerSecret } = config();
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const response = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`mpesa_oauth_error:${response.status}`);
  const parsed = JSON.parse(body) as { access_token?: string };
  if (!parsed.access_token) throw new Error("mpesa_access_token_missing");
  return parsed.access_token;
}

function timestamp() {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
}

export class MpesaPaymentAdapter implements PaymentAdapter {
  readonly provider = "mpesa" as const;

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    if (input.currency.toUpperCase() !== "KES") throw new Error("mpesa_only_supports_kes");
    const { shortCode, passKey, callbackUrl } = config();
    const phone = normalizePhone(input.customerPhone);
    const amount = Math.round(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid_payment_amount");

    const ts = timestamp();
    const password = Buffer.from(`${shortCode}${passKey}${ts}`).toString("base64");
    const token = await accessToken();
    const response = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: shortCode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: `SP-${input.appointmentId.slice(0, 18)}`,
        TransactionDesc: "SafariPlug service appointment",
      }),
    });
    const body = await response.text();
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(body) as Record<string, unknown>; } catch {}
    if (!response.ok || Number(parsed.ResponseCode ?? 0) !== 0) {
      throw new Error(`mpesa_stk_error:${response.status}:${String(parsed.ResponseDescription || body).slice(0, 300)}`);
    }

    const checkoutRequestId = String(parsed.CheckoutRequestID || "");
    if (!checkoutRequestId) throw new Error("mpesa_checkout_request_missing");
    return {
      id: checkoutRequestId,
      provider: "mpesa",
      providerReference: checkoutRequestId,
      appointmentId: input.appointmentId,
      amount: input.amount,
      currency: "KES",
      status: "processing",
      checkoutUrl: null,
      clientSecret: null,
    };
  }

  async getPaymentStatus(providerReference: string): Promise<PaymentIntentStatus> {
    // Daraja's STK callback is the authoritative completion signal for the normal checkout flow.
    // A query API can be added later for reconciliation; never assume a successful request means paid.
    return providerReference ? "processing" : "requires_payment";
  }
}
