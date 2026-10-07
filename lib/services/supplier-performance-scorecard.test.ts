import assert from "node:assert/strict";
import test from "node:test";
import { supplierPerformanceScore } from "./supplier-performance-scorecard";

test("strong supplier receives high score", () => {
  const result = supplierPerformanceScore({
    bookingStatusOpen: true,
    activeAvailabilityCount: 5,
    payoutAccountVerified: true,
    payoutIssueCount: 0,
    completed: 18,
    cancelled: 1,
    noShow: 1,
    openQualityIssues: 0,
  });
  assert.equal(result.completionRate, 90);
  assert.equal(result.failureRate, 10);
  assert.ok(result.score >= 85);
  assert.equal(result.band, "strong");
});

test("quality incidents and poor outcomes reduce score", () => {
  const result = supplierPerformanceScore({
    bookingStatusOpen: false,
    activeAvailabilityCount: 0,
    payoutAccountVerified: true,
    payoutIssueCount: 2,
    completed: 2,
    cancelled: 2,
    noShow: 1,
    openQualityIssues: 3,
  });
  assert.equal(result.completionRate, 40);
  assert.equal(result.failureRate, 60);
  assert.ok(result.score < 50);
  assert.equal(result.band, "attention");
});
