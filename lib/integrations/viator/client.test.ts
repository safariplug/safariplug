import assert from "node:assert/strict";
import test from "node:test";
import { assertViatorBookingEnabled, viatorBookingEnabled, viatorEnvironment } from "./client";

test("Viator defaults to sandbox and booking disabled", () => {
  const oldEnv = process.env.VIATOR_ENV;
  const oldBooking = process.env.VIATOR_BOOKING_ENABLED;
  delete process.env.VIATOR_ENV;
  delete process.env.VIATOR_BOOKING_ENABLED;

  try {
    assert.equal(viatorEnvironment(), "sandbox");
    assert.equal(viatorBookingEnabled(), false);
    assert.throws(() => assertViatorBookingEnabled(), /Booking Access is not enabled/);
  } finally {
    if (oldEnv === undefined) delete process.env.VIATOR_ENV; else process.env.VIATOR_ENV = oldEnv;
    if (oldBooking === undefined) delete process.env.VIATOR_BOOKING_ENABLED; else process.env.VIATOR_BOOKING_ENABLED = oldBooking;
  }
});

test("Viator booking gate opens only when explicitly enabled", () => {
  const oldBooking = process.env.VIATOR_BOOKING_ENABLED;
  process.env.VIATOR_BOOKING_ENABLED = "true";

  try {
    assert.equal(viatorBookingEnabled(), true);
    assert.doesNotThrow(() => assertViatorBookingEnabled());
  } finally {
    if (oldBooking === undefined) delete process.env.VIATOR_BOOKING_ENABLED; else process.env.VIATOR_BOOKING_ENABLED = oldBooking;
  }
});

test("Viator production environment must be explicit", () => {
  const oldEnv = process.env.VIATOR_ENV;
  process.env.VIATOR_ENV = "production";

  try {
    assert.equal(viatorEnvironment(), "production");
  } finally {
    if (oldEnv === undefined) delete process.env.VIATOR_ENV; else process.env.VIATOR_ENV = oldEnv;
  }
});
