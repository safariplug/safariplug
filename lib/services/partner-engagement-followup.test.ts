import assert from "node:assert/strict";
import test from "node:test";
import { earlierDueAt, partnerEngagementFollowup } from "./partner-engagement-followup";

test("click engagement creates a higher-priority 24h follow-up", () => {
  const now = Date.parse("2026-10-07T12:00:00.000Z");
  const result = partnerEngagementFollowup("clicked", now);
  assert.equal(result.priority, "high");
  assert.equal(result.dueAt, "2026-10-08T12:00:00.000Z");
  assert.match(result.title, /click/i);
});

test("open engagement creates a 48h follow-up", () => {
  const now = Date.parse("2026-10-07T12:00:00.000Z");
  const result = partnerEngagementFollowup("opened", now);
  assert.equal(result.priority, "normal");
  assert.equal(result.dueAt, "2026-10-09T12:00:00.000Z");
});

test("existing earlier follow-up is never pushed later", () => {
  assert.equal(
    earlierDueAt("2026-10-08T09:00:00.000Z", "2026-10-09T09:00:00.000Z"),
    "2026-10-08T09:00:00.000Z",
  );
});
