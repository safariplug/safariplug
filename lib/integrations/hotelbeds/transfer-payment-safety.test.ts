import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeTransferCheckoutIntentKey,
  transferPaymentSafeToRetry,
} from "./transfer-payment-safety";

test("transfer checkout idempotency keys require a durable opaque key", () => {
  assert.equal(
    normalizeTransferCheckoutIntentKey("31f93855-5384-4a16-bbcc-d2a3b41d6315"),
    "31f93855-5384-4a16-bbcc-d2a3b41d6315"
  );
  assert.throws(() => normalizeTransferCheckoutIntentKey("short"), /idempotency key/);
  assert.throws(() => normalizeTransferCheckoutIntentKey("bad key with spaces"), /idempotency key/);
});

test("only pre-submission M-Pesa failures are marked safe to retry", () => {
  assert.equal(transferPaymentSafeToRetry(new Error("mpesa_oauth_error:401")), true);
  assert.equal(transferPaymentSafeToRetry(new Error("mpesa_access_token_missing")), true);
  assert.equal(transferPaymentSafeToRetry(new Error("invalid_mpesa_phone")), true);
  assert.equal(transferPaymentSafeToRetry(new Error("mpesa_submission_uncertain")), false);
  assert.equal(transferPaymentSafeToRetry(new Error("mpesa_stk_response_uncertain")), false);
  assert.equal(transferPaymentSafeToRetry(new Error("mpesa_stk_rejected:400:Rejected")), false);
});
