import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractHotelbedsContentPage,
  isHotelbedsStatementTimeout,
  normalizeHotelbedsContentHotel,
  splitHotelbedsStorageBatch,
} from "./hotelbeds-content-sync";

test("Hotelbeds content page extraction supports the documented top-level hotel array", () => {
  const page = extractHotelbedsContentPage({
    from: 1,
    to: 2,
    total: 10,
    hotels: [{ code: 101 }, { code: 102 }],
  });
  assert.equal(page.hotels.length, 2);
  assert.equal(page.total, 10);
  assert.equal(page.from, 1);
  assert.equal(page.to, 2);
});

test("Hotelbeds content normalization keeps searchable fields and raw supplier content", () => {
  const row = normalizeHotelbedsContentHotel({
    code: 101,
    name: "Safari Test Hotel",
    destinationCode: "NBO",
    destinationName: "Nairobi",
    countryCode: "KE",
    categoryCode: "4EST",
    categoryName: "4 STARS",
    latitude: -1.28,
    longitude: 36.82,
    address: { content: "1 Test Road" },
    description: { content: "Hotel description" },
    images: [{ path: "image.jpg" }],
    facilities: [{ facilityCode: 1 }],
    rooms: [{ roomCode: "DBL.ST" }],
    lastUpdate: "2026-09-16",
  }, "ENG", "2026-09-17T00:00:00.000Z");

  assert.ok(row);
  assert.equal(row.hotel_code, 101);
  assert.equal(row.destination_code, "NBO");
  assert.equal(row.country_code, "KE");
  assert.deepEqual(row.coordinates, { latitude: -1.28, longitude: 36.82 });
  assert.equal(row.images.length, 1);
  assert.equal(row.rooms.length, 1);
  assert.equal(row.raw.name, "Safari Test Hotel");
});

test("Hotelbeds content normalization refuses rows without a valid supplier hotel code", () => {
  assert.equal(normalizeHotelbedsContentHotel({ name: "No code" }), null);
  assert.equal(normalizeHotelbedsContentHotel({ code: -1, name: "Bad code" }), null);
});

test("Hotelbeds storage recognizes PostgreSQL statement timeouts", () => {
  assert.equal(isHotelbedsStatementTimeout("canceling statement due to statement timeout"), true);
  assert.equal(isHotelbedsStatementTimeout("statement timeout"), true);
  assert.equal(isHotelbedsStatementTimeout("duplicate key value violates unique constraint"), false);
});

test("Hotelbeds storage splits timed-out batches deterministically", () => {
  assert.deepEqual(splitHotelbedsStorageBatch([1, 2, 3, 4]), [[1, 2], [3, 4]]);
  assert.deepEqual(splitHotelbedsStorageBatch([1, 2, 3]), [[1, 2], [3]]);
  assert.deepEqual(splitHotelbedsStorageBatch([1]), [[1], []]);
});
