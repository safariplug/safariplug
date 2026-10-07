import assert from "node:assert/strict";
import test from "node:test";
import { supplierGrowthRecommendations, supplierPerformanceScore } from "./supplier-performance-scorecard";

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


test("strong proven supplier is recommended for promotion", () => {
  const recommendations = supplierGrowthRecommendations({
    score: 92,
    bookingStatusOpen: true,
    activeAvailabilityCount: 5,
    activeOfferingCount: 3,
    bookings30d: 12,
    completionRate: 92,
    failureRate: 8,
    payoutIssueCount: 0,
    openQualityIssues: 0,
  });
  assert.ok(recommendations.some((item) => item.key === "promote_supplier"));
  assert.ok(!recommendations.some((item) => item.priority === "high"));
});

test("healthy inventory with no bookings gets demand recommendation", () => {
  const recommendations = supplierGrowthRecommendations({
    score: 80,
    bookingStatusOpen: true,
    activeAvailabilityCount: 4,
    activeOfferingCount: 2,
    bookings30d: 0,
    completionRate: null,
    failureRate: null,
    payoutIssueCount: 0,
    openQualityIssues: 0,
  });
  assert.ok(recommendations.some((item) => item.key === "build_demand"));
});

test("operational blockers outrank growth recommendations", () => {
  const recommendations = supplierGrowthRecommendations({
    score: 35,
    bookingStatusOpen: false,
    activeAvailabilityCount: 0,
    activeOfferingCount: 1,
    bookings30d: 3,
    completionRate: 50,
    failureRate: 50,
    payoutIssueCount: 1,
    openQualityIssues: 2,
  });
  assert.equal(recommendations[0].priority, "high");
  assert.ok(recommendations.some((item) => item.key === "restore_bookability"));
  assert.ok(recommendations.some((item) => item.key === "resolve_payouts"));
});
