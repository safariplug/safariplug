import assert from "node:assert/strict";
import { test } from "node:test";
import { canSubmitSupplierOnboarding, isAppointmentProviderBusinessType } from "./supplier-onboarding";

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
