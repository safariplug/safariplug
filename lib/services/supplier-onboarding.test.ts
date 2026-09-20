import assert from "node:assert/strict";
import { test } from "node:test";
import { isAppointmentProviderBusinessType } from "./supplier-onboarding";

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
