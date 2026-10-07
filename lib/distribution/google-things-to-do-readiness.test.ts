import assert from "node:assert/strict";
import test from "node:test";
import { googleTtdReadiness } from "./google-things-to-do-readiness";

const base = {
  profileId: "profile-1",
  offeringId: "offering-1",
  category: "Diving & Marine",
  businessName: "Diani Ocean Dive",
  businessSlug: "diani-ocean-dive",
  description: "Guided reef dives in Diani.",
  address: "Diani Beach, Kenya",
  latitude: -4.279,
  longitude: 39.594,
  phone: "+254700000000",
  offeringName: "Two-tank reef dive",
  offeringDescription: "A guided two-tank reef dive.",
  durationMinutes: 240,
  price: 12000,
  currency: "KES",
  businessStatus: "active",
  profileStatus: "active",
  bookingStatus: "open",
  offeringStatus: "active",
};

test("marks a complete direct experience candidate as preflight eligible", () => {
  const result = googleTtdReadiness(base);
  assert.equal(result.eligible, true);
  assert.equal(result.blockers.length, 0);
  assert.equal(result.product.option.price?.currencyCode, "KES");
  assert.match(String(result.product.option.landingPageUrl), /services\/diani-ocean-dive/);
});

test("blocks products without a location and live price", () => {
  const result = googleTtdReadiness({ ...base, address: null, latitude: null, longitude: null, price: null });
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.some((x) => x.includes("physical location")));
  assert.ok(result.blockers.some((x) => x.includes("price")));
});

test("excludes non Things-to-do service categories", () => {
  const result = googleTtdReadiness({ ...base, category: "Hair & Beauty" });
  assert.equal(result.eligible, false);
});
