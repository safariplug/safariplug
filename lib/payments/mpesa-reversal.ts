export class MpesaReversalSubmissionError extends Error {
  constructor(
    message: string,
    public readonly submissionOutcome: "not_sent" | "uncertain",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "MpesaReversalSubmissionError";
  }
}

export function isMpesaReversalSubmissionUncertain(error: unknown) {
  return error instanceof MpesaReversalSubmissionError && error.submissionOutcome === "uncertain";
}

function config() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET?.trim();
  const shortCode = process.env.MPESA_SHORTCODE?.trim();
  const initiator = process.env.MPESA_REVERSAL_INITIATOR?.trim();
  const securityCredential = process.env.MPESA_REVERSAL_SECURITY_CREDENTIAL?.trim();
  const resultUrl = process.env.MPESA_REVERSAL_RESULT_URL?.trim();
  const timeoutUrl = process.env.MPESA_REVERSAL_TIMEOUT_URL?.trim();
  const callbackSecret =
    process.env.MPESA_REVERSAL_CALLBACK_SECRET?.trim() ||
    process.env.MPESA_B2C_CALLBACK_SECRET?.trim();
  if (!consumerKey || !consumerSecret || !shortCode || !initiator || !securityCredential || !resultUrl || !timeoutUrl || !callbackSecret) {
    throw new Error("mpesa_reversal_credentials_not_configured");
  }
  return {
    consumerKey,
    consumerSecret,
    shortCode,
    initiator,
    securityCredential,
    resultUrl: withCallbackSecret(resultUrl, callbackSecret),
    timeoutUrl: withCallbackSecret(timeoutUrl, callbackSecret),
  };
}

function withCallbackSecret(value: string, secret: string) {
  const url = new URL(value);
  url.searchParams.set("token", secret);
  return url.toString();
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

export type MpesaReversalResult = {
  accepted: true;
  originatorConversationId: string | null;
  conversationId: string | null;
  responseDescription: string | null;
};

export async function reverseMpesaTransaction(input: {
  transactionId: string;
  amount: number;
  remarks?: string;
  occasion?: string;
}): Promise<MpesaReversalResult> {
  const transactionId = input.transactionId.trim();
  const amount = Number(input.amount);

  if (!transactionId) throw new Error("mpesa_reversal_transaction_missing");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid_refund_amount");
  if (!Number.isInteger(amount)) {
    throw new MpesaReversalSubmissionError(
      "mpesa_reversal_fractional_amount_requires_reconciliation",
      "not_sent",
    );
  }

  const cfg = config();
  const token = await accessToken();

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/mpesa/reversal/v1/request`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Initiator: cfg.initiator,
        SecurityCredential: cfg.securityCredential,
        CommandID: "TransactionReversal",
        TransactionID: transactionId,
        Amount: amount,
        ReceiverParty: cfg.shortCode,
        RecieverIdentifierType: "4",
        ResultURL: cfg.resultUrl,
        QueueTimeOutURL: cfg.timeoutUrl,
        Remarks: (input.remarks || "SafariPlug restaurant refund").slice(0, 100),
        Occasion: (input.occasion || "Restaurant order refund").slice(0, 100),
      }),
    });
  } catch (error) {
    throw new MpesaReversalSubmissionError(
      "mpesa_reversal_submission_outcome_uncertain",
      "uncertain",
      { cause: error },
    );
  }

  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    throw new MpesaReversalSubmissionError(
      "mpesa_reversal_response_unreadable_after_submission",
      "uncertain",
      { cause: error },
    );
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(body) as Record<string, unknown>;
  } catch {}

  const responseCode = parsed.ResponseCode == null ? null : String(parsed.ResponseCode);
  const responseDescription =
    parsed.ResponseDescription == null ? null : String(parsed.ResponseDescription);

  if (responseCode && responseCode !== "0") {
    throw new MpesaReversalSubmissionError(
      `mpesa_reversal_rejected:${response.status}:${String(responseDescription || body).slice(0, 300)}`,
      "not_sent",
    );
  }

  if (!response.ok) {
    throw new MpesaReversalSubmissionError(
      `mpesa_reversal_http_error:${response.status}:${String(responseDescription || body).slice(0, 300)}`,
      response.status >= 500 ? "uncertain" : "not_sent",
    );
  }

  const originatorConversationId =
    parsed.OriginatorConversationID == null ? null : String(parsed.OriginatorConversationID).trim() || null;
  const conversationId =
    parsed.ConversationID == null ? null : String(parsed.ConversationID).trim() || null;

  if (!originatorConversationId && !conversationId) {
    throw new MpesaReversalSubmissionError(
      "mpesa_reversal_accepted_without_conversation_reference",
      "uncertain",
    );
  }

  return {
    accepted: true,
    originatorConversationId,
    conversationId,
    responseDescription,
  };
}
