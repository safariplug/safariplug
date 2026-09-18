import { HotelbedsProductRequestError } from "./client";

export function normalizeActivityCheckoutIntentKey(value: unknown) {
  const key = String(value || "").trim();
  if (!/^[A-Za-z0-9._:-]{16,160}$/.test(key)) {
    throw new Error("A valid checkout idempotency key is required.");
  }
  return key;
}

export function activityPreconfirmDefinitelyRejected(error: unknown) {
  return error instanceof HotelbedsProductRequestError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408;
}

export function activityPaymentSafeToRetry(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.startsWith("mpesa_oauth_error:") ||
    message === "mpesa_access_token_missing" ||
    message === "mpesa_credentials_not_configured" ||
    message === "mpesa_base_url_not_configured" ||
    message === "invalid_mpesa_phone" ||
    message === "invalid_payment_amount"
  );
}
