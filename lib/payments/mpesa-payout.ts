export type MpesaPayoutStatus = "processing" | "succeeded" | "failed";

function config() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET?.trim();
  const shortcode = process.env.MPESA_SHORTCODE?.trim();
  const initiatorName = process.env.MPESA_B2C_INITIATOR_NAME?.trim();
  const securityCredential = process.env.MPESA_B2C_SECURITY_CREDENTIAL?.trim();
  const queueTimeoutUrl = process.env.MPESA_B2C_QUEUE_TIMEOUT_URL?.trim();
  const resultUrl = process.env.MPESA_B2C_RESULT_URL?.trim();
  if (!consumerKey || !consumerSecret || !shortcode || !initiatorName || !securityCredential || !queueTimeoutUrl || !resultUrl) {
    throw new Error("mpesa_b2c_credentials_not_configured");
  }
  return { consumerKey, consumerSecret, shortcode, initiatorName, securityCredential, queueTimeoutUrl, resultUrl };
}

function baseUrl() {
  const configured = process.env.MPESA_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("mpesa_base_url_not_configured");
  return "https://sandbox.safaricom.co.ke";
}

function normalizePhone(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  throw new Error("invalid_mpesa_payout_phone");
}

async function accessToken() {
  const { consumerKey, consumerSecret } = config();
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const response = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }, cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`mpesa_oauth_error:${response.status}`);
  const parsed = JSON.parse(body) as { access_token?: string };
  if (!parsed.access_token) throw new Error("mpesa_access_token_missing");
  return parsed.access_token;
}

export type MpesaPayoutInput = {
  payoutId: string;
  phone: string;
  amount: number;
  remarks?: string;
  occasion?: string;
};

export async function createMpesaB2CPayout(input: MpesaPayoutInput) {
  const cfg = config();
  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid_mpesa_payout_amount");
  const token = await accessToken();
  const response = await fetch(`${baseUrl()}/mpesa/b2c/v1/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      InitiatorName: cfg.initiatorName,
      SecurityCredential: cfg.securityCredential,
      CommandID: "BusinessPayment",
      Amount: amount,
      PartyA: cfg.shortcode,
      PartyB: normalizePhone(input.phone),
      Remarks: input.remarks || `SafariPlug provider payout ${input.payoutId}`,
      QueueTimeOutURL: cfg.queueTimeoutUrl,
      ResultURL: cfg.resultUrl,
      Occasion: input.occasion || "SafariPlug provider payout",
    }),
  });
  const body = await response.text();
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(body) as Record<string, unknown>; } catch {}
  if (!response.ok || String(parsed.ResponseCode ?? "0") !== "0") {
    throw new Error(`mpesa_b2c_error:${response.status}:${String(parsed.ResponseDescription || body).slice(0, 300)}`);
  }
  const conversationId = String(parsed.ConversationID || parsed.OriginatorConversationID || "");
  if (!conversationId) throw new Error("mpesa_b2c_conversation_missing");
  return { payoutId: input.payoutId, providerReference: conversationId, status: "processing" as const, raw: parsed };
}
