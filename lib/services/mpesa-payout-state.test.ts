import assert from "node:assert/strict";
import test from "node:test";
import {
  MpesaPayoutSubmissionError,
  isMpesaPayoutSubmissionUncertain,
} from "@/lib/payments/mpesa-payout";

test("uncertain M-Pesa payout submissions are classified as reconciliation-required", () => {
  const error = new MpesaPayoutSubmissionError(
    "mpesa_b2c_submission_outcome_uncertain",
    "uncertain",
  );
  assert.equal(isMpesaPayoutSubmissionUncertain(error), true);
});

test("confirmed M-Pesa rejection is not classified as uncertain", () => {
  const error = new MpesaPayoutSubmissionError(
    "mpesa_b2c_error:400:Rejected",
    "not_sent",
  );
  assert.equal(isMpesaPayoutSubmissionUncertain(error), false);
  assert.equal(isMpesaPayoutSubmissionUncertain(new Error("generic")), false);
});
