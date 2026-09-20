import assert from "node:assert/strict";
import { test } from "node:test";
import { canSubmitSupplierOnboarding, isAppointmentProviderBusinessType, supplierNextAction } from "./supplier-onboarding";

test("service supplier stays appointment-based before profile creation", () => {
  assert.equal(isAppointmentProviderBusinessType("Barber", false), true);
  assert.equal(isAppointmentProviderBusinessType("Tattoo & Body Art", false), true);
});

test("non-appointment supplier types stay excluded", () => {
  assert.equal(isAppointmentProviderBusinessType("Restaurant", true), false);
  assert.equal(isAppointmentProviderBusinessType("Hotel", true), false);
  assert.equal(isAppointmentProviderBusinessType("Event Organizer", true), false);
});

test("blank business type falls back to profile presence", () => {
  assert.equal(isAppointmentProviderBusinessType(null, false), false);
  assert.equal(isAppointmentProviderBusinessType("", true), true);
});


test("submission requires canonical readiness", () => {
  assert.equal(canSubmitSupplierOnboarding({ locked: false, submitted: false, ready: false }), false);
  assert.equal(canSubmitSupplierOnboarding({ locked: false, submitted: false, ready: true }), true);
  assert.equal(canSubmitSupplierOnboarding({ locked: true, submitted: false, ready: true }), false);
  assert.equal(canSubmitSupplierOnboarding({ locked: false, submitted: true, ready: true }), false);
});


test("supplier next action follows canonical readiness order", () => {
  const issues = [
    { key: "business_details", label: "Complete business details", href: "#business-details" },
    { key: "business_images", label: "Add business images", href: "#business-images" },
  ];
  const next = supplierNextAction({
    onboardingStatus: "draft",
    readinessReady: false,
    readinessIssues: issues,
  });
  assert.equal(next.title, "Complete business details");
  assert.equal(next.href, "#business-details");
});

test("requested changes take priority in supplier next action", () => {
  const issues = [
    { key: "business_images", label: "Add business images", href: "#business-images" },
    { key: "payout_details", label: "Verify payout details", href: "/business/payouts" },
  ];
  const next = supplierNextAction({
    onboardingStatus: "changes_requested",
    readinessReady: false,
    readinessIssues: issues,
    reviewItems: ["payout_details"],
  });
  assert.equal(next.title, "Verify payout details");
  assert.equal(next.href, "/business/payouts");
});

test("ready suppliers are directed to submission", () => {
  const next = supplierNextAction({
    onboardingStatus: "draft",
    readinessReady: true,
    readinessIssues: [],
  });
  assert.equal(next.title, "Submit for SafariPlug review");
  assert.equal(next.href, "#submit-for-review");
});


test("supplier next action skips platform-owned blockers", () => {
  const next = supplierNextAction({
    onboardingStatus: "draft",
    readinessReady: false,
    readinessIssues: [
      { key: "verification", label: "SafariPlug verification is not configured", href: "/business/verification", owner: "platform" },
      { key: "payout_details", label: "Configure payout details", href: "/business/payouts", owner: "supplier" },
    ],
  });
  assert.equal(next.title, "Configure payout details");
  assert.equal(next.href, "/business/payouts");
});

test("platform blocker becomes waiting state when supplier work is complete", () => {
  const next = supplierNextAction({
    onboardingStatus: "draft",
    readinessReady: false,
    readinessIssues: [
      { key: "verification", label: "SafariPlug verification is not configured", href: "/business/verification", owner: "platform" },
    ],
  });
  assert.equal(next.title, "Waiting on SafariPlug verification setup");
  assert.equal(next.href, null);
});
