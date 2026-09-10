function config() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET?.trim();
  const shortCode = process.env.MPESA_SHORTCODE?.trim();
  const initiator = process.env.MPESA_REVERSAL_INITIATOR?.trim();
  const securityCredential = process.env.MPESA_REVERSAL_SECURITY_CREDENTIAL?.trim();
  const resultUrl = process.env.MPESA_REVERSAL_RESULT_URL?.trim();
  const timeoutUrl = process.env.MPESA_REVERSAL_TIMEOUT_URL?.trim();
  if (!consumerKey || !consumerSecret || !shortCode || !initiator || !securityCredential || !resultUrl || !timeoutUrl) throw new Error("mpesa_reversal_credentials_not_configured");
  return { consumerKey, consumerSecret, shortCode, initiator, securityCredential, resultUrl, timeoutUrl };
}
function baseUrl() {
  const configured = process.env.MPESA_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("mpesa_base_url_not_configured");
  return "https://sandbox.safaricom.co.ke";
}
async function accessToken() {
  const { consumerKey, consumerSecret } = config();
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const response = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" });
  const body = await response.text();
  if (!response.ok) throw new Error(`mpesa_oauth_error:${response.status}`);
  const parsed = JSON.parse(body) as { access_token?: string };
  if (!parsed.access_token) throw new Error("mpesa_access_token_missing");
  return parsed.access_token;
}
export type MpesaReversalResult = { accepted: boolean; originatorConversationId: string | null; conversationId: string | null; responseDescription: string | null };
export async function reverseMpesaTransaction(input: { transactionId: string; amount: number; remarks?: string; occasion?: string }): Promise<MpesaReversalResult> {
  const cfg = config(); const amount = Math.round(input.amount);
  if (!input.transactionId.trim()) throw new Error("mpesa_reversal_transaction_missing");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid_refund_amount");
  const token = await accessToken();
  const response = await fetch(`${baseUrl()}/mpesa/reversal/v1/request`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ Initiator: cfg.initiator, SecurityCredential: cfg.securityCredential, CommandID: "TransactionReversal", TransactionID: input.transactionId.trim(), Amount: amount, ReceiverParty: cfg.shortCode, RecieverIdentifierType: "4", ResultURL: cfg.resultUrl, QueueTimeOutURL: cfg.timeoutUrl, Remarks: (input.remarks || "SafariPlug restaurant refund").slice(0, 100), Occasion: (input.occasion || "Restaurant order refund").slice(0, 100) }) });
  const body = await response.text(); let parsed: Record<string, unknown> = {}; try { parsed = JSON.parse(body) as Record<string, unknown>; } catch {}
  if (!response.ok) throw new Error(`mpesa_reversal_http_error:${response.status}`);
  const responseCode = String(parsed.ResponseCode ?? "");
  return { accepted: responseCode === "0" || Boolean(parsed.OriginatorConversationID || parsed.ConversationID), originatorConversationId: parsed.OriginatorConversationID == null ? null : String(parsed.OriginatorConversationID), conversationId: parsed.ConversationID == null ? null : String(parsed.ConversationID), responseDescription: parsed.ResponseDescription == null ? null : String(parsed.ResponseDescription) };
}
