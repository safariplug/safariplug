import assert from "node:assert/strict";
import test from "node:test";
import { postAuthDestination, safeInternalNext } from "./post-auth-destination";

test("full admins always land in the admin command center", () => {
  assert.equal(postAuthDestination({ isAdmin: true, isStaff: true, next: "/account" }), "/admin");
});

test("staff users land in the staff portal", () => {
  assert.equal(postAuthDestination({ isStaff: true, next: "/account" }), "/staff");
});

test("ordinary users keep a safe requested destination", () => {
  assert.equal(postAuthDestination({ next: "/account/hotels" }), "/account/hotels");
  assert.equal(postAuthDestination({ next: "/partners/join/token-123", accountIntent: "partner" }), "/partners/join/token-123");
  assert.equal(postAuthDestination({ next: "/account/verification?next=%2Fdrivers" }), "/account/verification?next=%2Fdrivers");
});

test("account intent supplies the correct fallback", () => {
  assert.equal(postAuthDestination({ accountIntent: "partner" }), "/business/services");
  assert.equal(postAuthDestination({ accountIntent: "local" }), "/locals/onboarding");
  assert.equal(postAuthDestination({ accountIntent: "traveler" }), "/account");
});

test("supplier account metadata routes legacy supplier confirmation to onboarding", () => {
  assert.equal(postAuthDestination({ accountType: "supplier" }), "/supplier/onboarding");
});

test("unsafe or privileged requested paths are not honored for ordinary users", () => {
  assert.equal(safeInternalNext("//evil.example"), null);
  assert.equal(postAuthDestination({ next: "//evil.example" }), "/account");
  assert.equal(postAuthDestination({ next: "/admin" }), "/account");
  assert.equal(postAuthDestination({ next: "/staff" }), "/account");
  assert.equal(postAuthDestination({ next: "/login" }), "/account");
});
