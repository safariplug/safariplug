import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchHotels, fetchTransferSearch, fetchTrips } from "./inventory";

test("hotel 503 is not_configured and never becomes fake hotels", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "hotel_inventory_not_configured",
          message: "Hotel inventory is not configured.",
        },
      }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  try {
    const result = await fetchHotels();
    assert.equal(result.status, "not_configured");
    assert.equal(result.data, null);
    assert.equal(result.code, "hotel_inventory_not_configured");
  } finally {
    globalThis.fetch = original;
  }
});

test("transfer search 503 is not_configured", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "transfer_inventory_not_configured",
          message: "Transfer inventory is not configured.",
        },
      }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  try {
    const result = await fetchTransferSearch();
    assert.equal(result.status, "not_configured");
    assert.equal(result.data, null);
  } finally {
    globalThis.fetch = original;
  }
});

test("trips 401 is unauthorized, not a fake itinerary", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: false,
        error: { code: "unauthorized", message: "Authentication required." },
      }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  try {
    const result = await fetchTrips();
    assert.equal(result.status, "unauthorized");
    assert.equal(result.data, null);
  } finally {
    globalThis.fetch = original;
  }
});
