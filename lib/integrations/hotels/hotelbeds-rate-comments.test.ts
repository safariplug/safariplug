import assert from "node:assert/strict";
import { test } from "node:test";
import { extractHotelbedsRateComments, hotelbedsRateCommentsUrl } from "./hotelbeds-rate-comments";

test("extractHotelbedsRateComments selects comments applicable to check-in date", () => {
  const payload = {
    rateComments: [
      {
        incoming: "102",
        hotel: "14978",
        code: "173049",
        comments: [
          { dateStart: "2026-01-01", dateEnd: "2026-06-30", description: { content: "Old comment" } },
          { dateStart: "2026-07-01", dateEnd: "2026-12-31", description: { content: "Minimum age of registration 21" } },
        ],
      },
    ],
  };

  assert.deepEqual(extractHotelbedsRateComments(payload, "2026-09-17"), [
    {
      description: "Minimum age of registration 21",
      dateStart: "2026-07-01",
      dateEnd: "2026-12-31",
    },
  ]);
});

test("extractHotelbedsRateComments deduplicates descriptions", () => {
  const payload = {
    rateComments: {
      rateComments: [
        { description: "Key collection at reception" },
        { description: "Key collection at reception" },
      ],
    },
  };

  assert.equal(extractHotelbedsRateComments(payload, "2026-09-17").length, 1);
});

test("hotelbedsRateCommentsUrl scopes the Content API request to one rate comment code", () => {
  const previous = process.env.SAFARIPLUG_HOTEL_HOTELBEDS_ENV;
  process.env.SAFARIPLUG_HOTEL_HOTELBEDS_ENV = "test";
  try {
    const url = hotelbedsRateCommentsUrl("102|166598|0", "ENG");
    assert.equal(url.hostname, "api.test.hotelbeds.com");
    assert.equal(url.pathname, "/hotel-content-api/1.0/types/ratecomments");
    assert.equal(url.searchParams.get("code"), "102|166598|0");
    assert.equal(url.searchParams.get("fields"), "all");
    assert.equal(url.searchParams.get("language"), "ENG");
  } finally {
    if (previous === undefined) delete process.env.SAFARIPLUG_HOTEL_HOTELBEDS_ENV;
    else process.env.SAFARIPLUG_HOTEL_HOTELBEDS_ENV = previous;
  }
});
