import assert from "node:assert/strict";
import test from "node:test";
import { travelReviewEligible, travelReviewCompletionTime } from "./travel-review-eligibility";

test("hotel review opens after confirmed paid checkout", () => {
  const result=travelReviewEligible({product:"hotel",bookingStatus:"confirmed",paymentStatus:"paid",metadata:{checkOut:"2026-10-01"},nowMs:Date.parse("2026-10-07T12:00:00Z")});
  assert.equal(result.eligible,true);
});

test("future activity cannot be reviewed", () => {
  const result=travelReviewEligible({product:"activity",bookingStatus:"confirmed",paymentStatus:"paid",metadata:{activity:{from:"2026-10-10",to:"2026-10-10"}},nowMs:Date.parse("2026-10-07T12:00:00Z")});
  assert.equal(result.eligible,false);
});

test("roundtrip transfer waits for inbound leg", () => {
  const completion=travelReviewCompletionTime("transfer",{route:{outbound:"2026-10-01T10:00:00Z",inbound:"2026-10-09T10:00:00Z"}});
  assert.equal(completion,Date.parse("2026-10-09T10:00:00Z"));
});
