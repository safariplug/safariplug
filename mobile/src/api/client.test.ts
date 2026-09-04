import assert from "node:assert/strict";
import { test } from "node:test";
import { apiGet, ApiError } from "./client";

test("HTTP errors become ApiError and never fake catalog rows", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success: false, error: { code: "not_found", message: "Event not found." } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  try {
    await assert.rejects(() => apiGet("/events/missing"), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 404);
      assert.equal(err.code, "not_found");
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("malformed success payload is rejected", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ events: [{ title: "fake" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  try {
    await assert.rejects(() => apiGet("/events"), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "malformed_response");
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});
