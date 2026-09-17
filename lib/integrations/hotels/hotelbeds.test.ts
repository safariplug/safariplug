import assert from "node:assert/strict";
import { test } from "node:test";
import { HotelbedsHotelAdapter, buildHotelbedsOccupancies, hotelbedsSignature } from "./hotelbeds";

test("hotelbeds signature is sha256(apiKey + secret + unix timestamp)", () => {
  assert.equal(
    hotelbedsSignature("key", "secret", 1700000000),
    "278d74471a3b5267e27221967122169ad26fac349e0fb6a94779cdf050a0d038"
  );
});

test("hotelbeds remains not configured without all server credentials", () => {
  const names = [
    "SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY",
    "SAFARIPLUG_HOTEL_HOTELBEDS_SECRET",
    "SAFARIPLUG_HOTEL_HOTELBEDS_CERT_PEM",
    "SAFARIPLUG_HOTEL_HOTELBEDS_CERT",
    "SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY_PEM",
    "SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY",
  ];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    const adapter = new HotelbedsHotelAdapter();
    assert.equal(adapter.credentialsPresent(), false);
    assert.equal(adapter.status(), "not_configured");
    assert.equal(adapter.contractImplemented(), true);
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("hotelbeds certification occupancies preserve all rooms and child ages", () => {
  assert.deepEqual(
    buildHotelbedsOccupancies({ rooms: 2, guests: 6, adults: 5, children: 1, child_ages: [7] }),
    [
      { rooms: 1, adults: 3, children: 1, paxes: [{ type: "CH", age: 7 }] },
      { rooms: 1, adults: 2, children: 0 },
    ]
  );
});

test("hotelbeds rejects children without matching ages", () => {
  assert.throws(
    () => buildHotelbedsOccupancies({ rooms: 1, guests: 3, adults: 2, children: 1 }),
    /age for every child/
  );
});

test("hotelbeds generic capabilities do not claim unsupported quote or confirm", () => {
  const adapter = new HotelbedsHotelAdapter();
  assert.deepEqual(adapter.capabilities(), {
    search: true,
    availability: false,
    quote: false,
    hold: false,
    confirm: false,
    cancel: false,
  });
});
