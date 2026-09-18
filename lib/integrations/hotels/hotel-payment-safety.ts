export function normalizeHotelCheckoutIntentKey(value: unknown) {
  const key = String(value || "").trim();
  if (!/^[A-Za-z0-9._:-]{16,160}$/.test(key)) {
    throw new Error("A valid checkout idempotency key is required.");
  }
  return key;
}

export function hotelPaymentSafeToRetry(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.startsWith("mpesa_oauth_error:") ||
    message === "mpesa_access_token_missing" ||
    message === "mpesa_credentials_not_configured" ||
    message === "mpesa_base_url_not_configured" ||
    message === "invalid_mpesa_phone" ||
    message === "invalid_payment_amount" ||
    message === "mpesa_only_supports_kes"
  );
}

export function publicHotelCheckoutIntentStatus(
  state: string,
  preparedBookingId?: string | null
) {
  return {
    status:
      state === "payment_pending"
        ? "payment_pending"
        : state === "payment_indeterminate"
          ? "payment_initiation_indeterminate"
          : state === "supplier_prepare_indeterminate"
            ? "supplier_prepare_indeterminate"
            : state === "supplier_prepared"
              ? "payment_initializing"
              : state === "confirmed"
                ? "confirmed"
                : "checkout_initializing",
    bookingId: preparedBookingId || null,
    reconciliation:
      state === "payment_indeterminate" ||
      state === "supplier_prepare_indeterminate"
        ? "manual_required"
        : undefined,
  };
}
