import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHotelbedsCertificationPlan } from "./hotelbeds-certification-plan";

test("Hotelbeds certification plan separates safe, blocked and manual steps", () => {
  const plan = buildHotelbedsCertificationPlan({
    apiKey: true,
    secret: true,
    certificate: true,
    privateKey: true,
    contentConfigured: true,
    cachedHotels: 25,
  });

  assert.equal(plan.blocked, 0);
  assert.equal(plan.manual, 3);
  assert.deepEqual(plan.safeToRunAutomatically, ["health", "content", "availability", "checkrate", "traveler-preflight"]);
  assert.equal(plan.steps.find((step) => step.id === "payment")?.destructive, true);
  assert.equal(plan.steps.find((step) => step.id === "booking")?.status, "manual");
});

test("Hotelbeds certification plan surfaces mTLS and cache blockers", () => {
  const plan = buildHotelbedsCertificationPlan({
    apiKey: true,
    secret: true,
    certificate: false,
    privateKey: false,
    contentConfigured: true,
    cachedHotels: 0,
  });

  assert.equal(plan.steps.find((step) => step.id === "health")?.status, "ready");
  assert.equal(plan.steps.find((step) => step.id === "content")?.status, "blocked");
  assert.equal(plan.steps.find((step) => step.id === "availability")?.status, "blocked");
  assert.equal(plan.steps.find((step) => step.id === "checkrate")?.status, "blocked");
  assert.equal(plan.steps.find((step) => step.id === "traveler-preflight")?.status, "blocked");
});
