import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHotelSearchRequest } from "@/lib/services/hotels";

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
