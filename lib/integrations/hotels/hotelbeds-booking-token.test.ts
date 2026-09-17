import assert from "node:assert/strict";
import { test } from "node:test";
import { openHotelbedsBookingToken, sealHotelbedsBookingToken } from "./hotelbeds-booking-token";

const payload = {
  rateKey: "rate-key-1",
  rateType: "BOOKABLE",
  rateClass: "NOR",
  supplierNet: 100,
  supplierCurrency: "USD",
  propertyId: "123",
  propertyName: "Test Hotel",
  hotelAddress: "1 Test Road",
  hotelCategory: "4 STARS",
  hotelDestination: "Nairobi",
  roomId: "DBL.ST",
  roomName: "Double Standard",
  boardCode: "BB",
  boardName: "Bed & Breakfast",
  cancellation: "Free cancellation",
  notices: ["City tax payable locally"],
  checkIn: "2026-10-01",
  checkOut: "2026-10-05",
};

test("Hotelbeds booking token is encrypted, authenticated and expires", () => {
  const previous = process.env.SAFARIPLUG_HOTEL_HOTELBEDS_SECRET;
  process.env.SAFARIPLUG_HOTEL_HOTELBEDS_SECRET = "test-secret-not-for-production";
  try {
    const token = sealHotelbedsBookingToken(payload, 1000, 60);
    assert.equal(token.includes("rate-key-1"), false);
    const opened = openHotelbedsBookingToken(token, 1020);
    assert.equal(opened.rateKey, "rate-key-1");
    assert.equal(opened.supplierNet, 100);
    assert.deepEqual(opened.notices, ["City tax payable locally"]);
    assert.throws(() => openHotelbedsBookingToken(`${token}x`, 1020));
    assert.throws(() => openHotelbedsBookingToken(token, 1060), /expired/);
  } finally {
    if (previous === undefined) delete process.env.SAFARIPLUG_HOTEL_HOTELBEDS_SECRET;
    else process.env.SAFARIPLUG_HOTEL_HOTELBEDS_SECRET = previous;
  }
});
