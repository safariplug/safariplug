import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildHotelbedsCertificationStay,
  summarizeHotelbedsAvailabilityProbe,
} from "./hotelbeds-certification-probe";

test("Hotelbeds certification stay is generated in the future with a fixed night count", () => {
  const stay = buildHotelbedsCertificationStay(new Date("2026-09-17T02:00:00.000Z"), 30, 2);
  assert.deepEqual(stay, { checkIn: "2026-10-17", checkOut: "2026-10-19" });
});

test("Hotelbeds availability certification summary hides supplier booking secrets", () => {
  const summary = summarizeHotelbedsAvailabilityProbe([{
    provider: "hotelbeds",
    property_id: "123",
    property_name: "Test Hotel",
    room_id: "DBL.ST",
    rate_id: "secret-rate-key",
    currency: "KES",
    total: { amount: 15000, currency: "KES" },
    cancellation: "Free cancellation",
    availability: "available",
    source: "supplier",
    supplier_context: {
      search_key: "RECHECK",
      rate_class: "NOR",
      board_code: "BB",
      board_name: "Bed & Breakfast",
      booking_token: "encrypted-booking-token",
      notices: ["City tax payable locally"],
    },
  }]);

  assert.equal(summary.resultCount, 1);
  assert.equal(summary.sample?.hasRateKey, true);
  assert.equal(summary.sample?.hasBookingToken, true);
  assert.equal("rate_id" in (summary.sample || {}), false);
  assert.equal("booking_token" in (summary.sample || {}), false);
});
