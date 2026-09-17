import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHotelSearchRequest } from "@/lib/services/hotels";
import {
  assertHotelbedsBookingRateReady,
  buildHotelbedsVoucher,
  certificationNotices,
  hotelbedsRequiresCheckRate,
} from "./hotelbeds-certification";
import { prepareHotelbedsRateForBooking } from "./hotelbeds-booking-workflow";
import {
  hotelbedsContentBaseUrl,
  hotelbedsContentConfigured,
  hotelbedsContentEnvironment,
  hotelbedsContentSignature,
  hotelbedsHotelContentUrl,
} from "./hotelbeds-content";

test("certification search accepts provider isolation and child ages", () => {
  const parsed = parseHotelSearchRequest({
    destination: "Nairobi",
    check_in: "2026-10-01",
    check_out: "2026-10-05",
    guests: "4",
    rooms: "2",
    adults: "2",
    children: "2",
    child_ages: "7,12",
    provider: "hotelbeds",
    currency: "KES",
  });
  assert.equal(parsed.provider, "hotelbeds");
  assert.equal(parsed.adults, 2);
  assert.equal(parsed.children, 2);
  assert.deepEqual(parsed.child_ages, [7, 12]);
});

test("certification search requires one age per child", () => {
  assert.throws(
    () => parseHotelSearchRequest({
      destination: "Nairobi",
      check_in: "2026-10-01",
      check_out: "2026-10-05",
      guests: "3",
      rooms: "1",
      adults: "2",
      children: "1",
    }),
    /age is required for every child/
  );
});

test("certification provider filter rejects unknown suppliers", () => {
  assert.throws(
    () => parseHotelSearchRequest({
      destination: "Nairobi",
      check_in: "2026-10-01",
      check_out: "2026-10-05",
      guests: "2",
      rooms: "1",
      provider: "made-up-provider",
    }),
    /provider is not supported/
  );
});

test("Hotelbeds only CheckRates RECHECK rates", () => {
  assert.equal(hotelbedsRequiresCheckRate("RECHECK"), true);
  assert.equal(hotelbedsRequiresCheckRate("BOOKABLE"), false);
  assert.doesNotThrow(() => assertHotelbedsBookingRateReady({ rateKey: "rk", rateType: "BOOKABLE" }, false));
  assert.throws(
    () => assertHotelbedsBookingRateReady({ rateKey: "rk", rateType: "RECHECK" }, false),
    /must complete CheckRate/
  );
  assert.doesNotThrow(() => assertHotelbedsBookingRateReady({ rateKey: "rk", rateType: "RECHECK" }, true));
});

test("BOOKABLE rate does not make an unnecessary CheckRate call", async () => {
  let calls = 0;
  const prepared = await prepareHotelbedsRateForBooking({
    checkRate: async () => { calls += 1; return { ok: true }; },
  }, { rateKey: "bookable-rate", rateType: "BOOKABLE" });
  assert.equal(calls, 0);
  assert.equal(prepared.checkRateRequired, false);
  assert.equal(prepared.checked, null);
});

test("RECHECK rate makes exactly one CheckRate call", async () => {
  let calls = 0;
  const prepared = await prepareHotelbedsRateForBooking({
    checkRate: async (rateKey) => { calls += 1; return { rateKey, status: "checked" }; },
  }, { rateKey: "recheck-rate", rateType: "RECHECK" });
  assert.equal(calls, 1);
  assert.equal(prepared.checkRateRequired, true);
  assert.equal(prepared.checkRateCompleted, true);
  assert.deepEqual(prepared.checked, { rateKey: "recheck-rate", status: "checked" });
});

test("certification notices include promotions and rate comments", () => {
  assert.deepEqual(
    certificationNotices({
      rateKey: "rk",
      promotions: [{ code: "073", name: "Non-refundable rate" }],
      rateComments: ["Parking payable locally"],
    }),
    ["Non-refundable rate", "Parking payable locally"]
  );
});

test("voucher contains Hotelbeds certification mandatory booking fields", () => {
  const voucher = buildHotelbedsVoucher({
    bookingReference: "HB-123",
    agencyReference: "SP-456",
    hotelName: "Example Hotel",
    hotelAddress: "1 Example Road",
    holderName: "Jane Doe",
    checkIn: "2026-10-01",
    checkOut: "2026-10-05",
    supplierName: "HBX Group",
    supplierVat: "VAT-1",
    rooms: [{
      roomType: "Double Standard",
      boardType: "Bed & Breakfast",
      passengers: [
        { name: "Jane Doe", type: "AD" },
        { name: "Child Doe", type: "CH", age: 7 },
      ],
      rateComments: ["City tax payable locally"],
    }],
  });
  assert.equal(voucher.booking_reference, "HB-123");
  assert.equal(voucher.hotel.name, "Example Hotel");
  assert.equal(voucher.rooms[0].room_type, "Double Standard");
  assert.equal(voucher.rooms[0].passengers[1].age, 7);
  assert.match(voucher.payment_notice || "", /HBX Group/);
});

test("voucher rejects a child without age", () => {
  assert.throws(() => buildHotelbedsVoucher({
    bookingReference: "HB-123",
    hotelName: "Example Hotel",
    hotelAddress: "1 Example Road",
    holderName: "Jane Doe",
    checkIn: "2026-10-01",
    checkOut: "2026-10-05",
    rooms: [{ roomType: "Double", boardType: "RO", passengers: [{ name: "Child", type: "CH" }] }],
  }), /Child age is mandatory/);
});

test("Hotelbeds Content API defaults to test and caps pages at 1000 hotels", () => {
  const previous = process.env.SAFARIPLUG_HOTEL_HOTELBEDS_ENV;
  delete process.env.SAFARIPLUG_HOTEL_HOTELBEDS_ENV;
  try {
    assert.equal(hotelbedsContentEnvironment(), "test");
    assert.equal(hotelbedsContentBaseUrl(), "https://api.test.hotelbeds.com");
    const url = hotelbedsHotelContentUrl(1, 5000, "eng");
    assert.equal(url.searchParams.get("from"), "1");
    assert.equal(url.searchParams.get("to"), "1000");
    assert.equal(url.searchParams.get("language"), "ENG");
  } finally {
    if (previous === undefined) delete process.env.SAFARIPLUG_HOTEL_HOTELBEDS_ENV;
    else process.env.SAFARIPLUG_HOTEL_HOTELBEDS_ENV = previous;
  }
});

test("Hotelbeds Content API configuration stays server-side", () => {
  const oldKey = process.env.SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY;
  const oldSecret = process.env.SAFARIPLUG_HOTEL_HOTELBEDS_SECRET;
  delete process.env.SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY;
  delete process.env.SAFARIPLUG_HOTEL_HOTELBEDS_SECRET;
  try {
    assert.equal(hotelbedsContentConfigured(), false);
    assert.equal(
      hotelbedsContentSignature("key", "secret", 1700000000),
      "278d74471a3b5267e27221967122169ad26fac349e0fb6a94779cdf050a0d038"
    );
  } finally {
    if (oldKey === undefined) delete process.env.SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY;
    else process.env.SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY = oldKey;
    if (oldSecret === undefined) delete process.env.SAFARIPLUG_HOTEL_HOTELBEDS_SECRET;
    else process.env.SAFARIPLUG_HOTEL_HOTELBEDS_SECRET = oldSecret;
  }
});
