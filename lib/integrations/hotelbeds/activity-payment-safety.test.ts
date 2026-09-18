import assert from "node:assert/strict";
import { test } from "node:test";
import { HotelbedsProductRequestError } from "./client";
import {
  normalizeActivityCheckoutIntentKey,
  activityPreconfirmDefinitelyRejected,
  activityPaymentSafeToRetry,
} from "./activity-payment-safety";

test("activity checkout idempotency key is validated", () => {
  assert.equal(normalizeActivityCheckoutIntentKey("1a56e5c7-406e-497e-bdb2-aed5689403c0"), "1a56e5c7-406e-497e-bdb2-aed5689403c0");
  assert.throws(() => normalizeActivityCheckoutIntentKey("short"), /idempotency key/);
});

test("Hotelbeds 4xx preconfirm errors are definite except timeout", () => {
  assert.equal(activityPreconfirmDefinitelyRejected(new HotelbedsProductRequestError("bad", 400)), true);
  assert.equal(activityPreconfirmDefinitelyRejected(new HotelbedsProductRequestError("timeout", 408)), false);
  assert.equal(activityPreconfirmDefinitelyRejected(new HotelbedsProductRequestError("server", 500)), false);
  assert.equal(activityPreconfirmDefinitelyRejected(new Error("network")), false);
});

test("only pre-submission M-Pesa failures are safe to retry", () => {
  assert.equal(activityPaymentSafeToRetry(new Error("mpesa_oauth_error:401")), true);
  assert.equal(activityPaymentSafeToRetry(new Error("invalid_mpesa_phone")), true);
  assert.equal(activityPaymentSafeToRetry(new Error("mpesa_submission_uncertain")), false);
  assert.equal(activityPaymentSafeToRetry(new Error("mpesa_stk_response_uncertain")), false);
});
