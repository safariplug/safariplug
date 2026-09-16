import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hotelbedsProductConfig,
  hotelbedsProductConfigured,
  hotelbedsProductSignature,
} from "./client";

test("Hotelbeds product signature is deterministic", () => {
  assert.equal(
    hotelbedsProductSignature("abc", "secret", 1234567890),
    "69b846a5f38d7680d221105308fde80aa7e856f5a9463e23f3ab7cb30bee9cc1"
  );
});

test("Hotelbeds Activities defaults to test environment", () => {
  const previous = process.env.SAFARIPLUG_HOTELBEDS_ACTIVITIES_ENV;
  delete process.env.SAFARIPLUG_HOTELBEDS_ACTIVITIES_ENV;
  try {
    const config = hotelbedsProductConfig("activities");
    assert.equal(config.environment, "test");
    assert.equal(config.baseUrl, "https://api.test.hotelbeds.com");
  } finally {
    if (previous === undefined) delete process.env.SAFARIPLUG_HOTELBEDS_ACTIVITIES_ENV;
    else process.env.SAFARIPLUG_HOTELBEDS_ACTIVITIES_ENV = previous;
  }
});

test("Hotelbeds Transfers requires both key and secret", () => {
  const oldKey = process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_API_KEY;
  const oldSecret = process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_SECRET;
  delete process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_API_KEY;
  delete process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_SECRET;
  try {
    assert.equal(hotelbedsProductConfigured("transfers"), false);
    process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_API_KEY = "key";
    assert.equal(hotelbedsProductConfigured("transfers"), false);
    process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_SECRET = "secret";
    assert.equal(hotelbedsProductConfigured("transfers"), true);
  } finally {
    if (oldKey === undefined) delete process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_API_KEY;
    else process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_API_KEY = oldKey;
    if (oldSecret === undefined) delete process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_SECRET;
    else process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_SECRET = oldSecret;
  }
});
