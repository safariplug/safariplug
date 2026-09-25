import assert from "node:assert/strict";
import test from "node:test";
import { hasApprovedLivenessSignal } from "./verification-signals";

test("human review does not masquerade as liveness", () => {
  assert.equal(hasApprovedLivenessSignal({ status: "approved", provider: "human_review" }, []), false);
});

test("accepted liveness evidence creates the liveness signal", () => {
  assert.equal(hasApprovedLivenessSignal(
    { status: "approved", provider: "identity_provider" },
    [{ evidence_type: "liveness", status: "accepted" }],
  ), true);
});

test("liveness-provider approval creates the liveness signal", () => {
  assert.equal(hasApprovedLivenessSignal({ status: "approved", provider: "liveness_provider" }, []), true);
});

test("non-approved cases never create a liveness signal", () => {
  assert.equal(hasApprovedLivenessSignal(
    { status: "in_review", provider: "liveness_provider" },
    [{ evidence_type: "liveness", status: "accepted" }],
  ), false);
});
