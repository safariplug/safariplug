import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hotelPaymentSafeToRetry,
  normalizeHotelCheckoutIntentKey,
  publicHotelCheckoutIntentStatus,
} from "./hotel-payment-safety";

test("hotel checkout intent keys require a stable opaque value", () => {
  const key = "32d73c7f-3ff8-4576-9a56-f5818b95a899";
  assert.equal(normalizeHotelCheckoutIntentKey(key), key);
  assert.throws(() => normalizeHotelCheckoutIntentKey("short"), /idempotency key/);
  assert.throws(() => normalizeHotelCheckoutIntentKey("bad key with spaces"), /idempotency key/);
});

test("only clearly pre-submission M-Pesa failures are safe to retry", () => {
  assert.equal(hotelPaymentSafeToRetry(new Error("mpesa_oauth_error:401")), true);
  assert.equal(hotelPaymentSafeToRetry(new Error("invalid_mpesa_phone")), true);
  assert.equal(hotelPaymentSafeToRetry(new Error("mpesa_submission_uncertain")), false);
  assert.equal(hotelPaymentSafeToRetry(new Error("mpesa_stk_response_uncertain")), false);
  assert.equal(hotelPaymentSafeToRetry(new Error("mpesa_stk_rejected:400:Rejected")), false);
});

test("indeterminate hotel checkout states require reconciliation", () => {
  assert.deepEqual(
    publicHotelCheckoutIntentStatus("supplier_prepare_indeterminate", "hotel-1"),
    {
      status: "supplier_prepare_indeterminate",
      bookingId: "hotel-1",
      reconciliation: "manual_required",
    }
  );
  assert.equal(
    publicHotelCheckoutIntentStatus("payment_pending", "hotel-2").status,
    "payment_pending"
  );
});
