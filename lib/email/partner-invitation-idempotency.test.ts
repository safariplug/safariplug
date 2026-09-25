import assert from "node:assert/strict";
import test from "node:test";
import { partnerInvitationEmailIdempotencyKey } from "./partner-invitation-idempotency";

test("partner invitation idempotency key is stable for the same approval", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  const approvedAt = "2026-09-25T16:30:00.000Z";
  const first = partnerInvitationEmailIdempotencyKey(id, approvedAt);
  const retry = partnerInvitationEmailIdempotencyKey(id, approvedAt);
  assert.equal(first, retry);
});

test("a new human approval gets a different idempotency key", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  assert.notEqual(
    partnerInvitationEmailIdempotencyKey(id, "2026-09-25T16:30:00.000Z"),
    partnerInvitationEmailIdempotencyKey(id, "2026-09-25T17:00:00.000Z"),
  );
});

test("legacy approved invitations still get a deterministic key", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  assert.equal(
    partnerInvitationEmailIdempotencyKey(id, null),
    `partner-invitation/${id}/legacy-approved`,
  );
});
