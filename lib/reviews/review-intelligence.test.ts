import assert from "node:assert/strict";
import test from "node:test";
import { travelReviewProductIdentity } from "./review-intelligence";

test("extracts Hotelbeds activity identity", () => {
  const result = travelReviewProductIdentity("activity", { activity: { code: "A-123", name: "Diani Reef Dive" } });
  assert.equal(result.productRef, "A-123");
  assert.equal(result.productName, "Diani Reef Dive");
  assert.equal(result.provider, "hotelbeds");
});

test("extracts route based transfer identity", () => {
  const result = travelReviewProductIdentity("transfer", { route: { from: { code: "NBO" }, to: { code: "DIANI" } }, service: { vehicleName: "SUV" } });
  assert.equal(result.productRef, "NBO:DIANI:SUV");
});

test("extracts hotel identity when metadata has hotel code", () => {
  const result = travelReviewProductIdentity("hotel", { hotelCode: "H100", hotelName: "Beach House", provider: "hotelbeds" });
  assert.equal(result.productRef, "H100");
  assert.equal(result.productName, "Beach House");
});
