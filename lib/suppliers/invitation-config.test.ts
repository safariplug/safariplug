import assert from "node:assert/strict";
import test from "node:test";
import {
  invitationDestination,
  invitationEnrollmentKind,
  resolveSupplierInvitationConfig,
} from "./invitation-config";

test("maps current Supplier Scout categories into supported onboarding", () => {
  const cases = [
    ["Barbers", "Barber", "Barbers"],
    ["Spas & Massage", "Spa & Massage", "Spas & Massage"],
    ["Yoga/Pilates/Mindfulness", "Yoga / Pilates / Mindfulness", "Yoga, Pilates & Mindfulness"],
    ["Water Sports & Kite", "Water Sports & Kite", "Water Sports & Kite"],
    ["Tours & Local Guides", "Tour Operator", "Tours & Local Guides"],
    ["Experiences", "Experience Provider", "Tours & Local Guides"],
    ["Hotels", "Hotel", undefined],
    ["Restaurants", "Restaurant", undefined],
    ["Nightlife", "Event Organizer", undefined],
    ["Beach Clubs", "Event Organizer", undefined],
  ] as const;

  for (const [partnerType, businessType, category] of cases) {
    const config = resolveSupplierInvitationConfig(partnerType);
    assert.ok(config, partnerType);
    assert.equal(config.businessType, businessType);
    assert.equal(config.category, category);
    assert.equal(invitationEnrollmentKind(partnerType), "supplier");
    assert.equal(invitationDestination(partnerType), "/supplier/onboarding");
  }
});

test("preserves legacy invitation labels", () => {
  assert.equal(resolveSupplierInvitationConfig("Tattoo")?.category, "Tattoo Artists & Body Art");
  assert.equal(resolveSupplierInvitationConfig("hotel / stay")?.businessType, "Hotel");
  assert.equal(resolveSupplierInvitationConfig("tour / experience")?.category, "Tours & Local Guides");
});

test("keeps driver and local invitations on their dedicated flows", () => {
  assert.equal(invitationEnrollmentKind("Airport Transfer Driver"), "driver");
  assert.equal(invitationDestination("Airport Transfer Driver"), "/driver/signup");
  assert.equal(invitationEnrollmentKind("Local Host"), "local");
  assert.equal(invitationDestination("Local Host"), "/locals/onboarding");
});

test("does not silently provision unsupported categories", () => {
  assert.equal(resolveSupplierInvitationConfig("Other"), null);
  assert.equal(invitationEnrollmentKind("Other"), "unsupported");
  assert.equal(invitationDestination("Other"), null);
});
