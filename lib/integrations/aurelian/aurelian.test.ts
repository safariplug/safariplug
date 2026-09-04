import assert from "node:assert/strict";
import { test } from "node:test";
import { validateIntegrationKey } from "../api-key";
import { healthCheck, syncExperience } from "./adapter";
import { getAurelianConfig, redactSecrets } from "./config";
import { mapEventToAurelianExperience } from "./payload";
import { syncApprovedExperiences } from "./sync";

const APPROVED_ID = "20fa2e8d-f6ee-43b6-809d-29e523aa4068";

test("inbound API key comparison does not leak the secret", () => {
  process.env.SAFARIPLUG_AURELIAN_API_KEY = "partner-secret-key";
  const bad = new Request("https://safariplug.com/api/integrations/aurelian/events", {
    headers: { "x-api-key": "wrong-key-value-xx" },
  });
  const good = new Request("https://safariplug.com/api/integrations/aurelian/events", {
    headers: { "x-api-key": "partner-secret-key" },
  });
  const missing = new Request("https://safariplug.com/api/integrations/aurelian/events");
  assert.equal(validateIntegrationKey(bad), false);
  assert.equal(validateIntegrationKey(good), true);
  assert.equal(validateIntegrationKey(missing), false);
});

test("config never returns the API key", () => {
  process.env.SAFARIPLUG_AURELIAN_API_KEY = "super-secret-value";
  delete process.env.AURELIAN_API_BASE_URL;
  const config = getAurelianConfig();
  assert.equal(config.inboundKeyConfigured, true);
  assert.equal(config.outboundContractAvailable, false);
  assert.equal(JSON.stringify(config).includes("super-secret-value"), false);
  const redacted = redactSecrets({
    SAFARIPLUG_AURELIAN_API_KEY: "super-secret-value",
    ok: true,
  });
  assert.equal(redacted.SAFARIPLUG_AURELIAN_API_KEY, "[redacted]");
});

test("mapper keeps approved public inventory and drops private fields", () => {
  const payload = mapEventToAurelianExperience({
    id: APPROVED_ID,
    title: "Festivals Kaleidoscope",
    description: "Night market",
    category: "Music & Nightlife",
    venue_name: "Uhuru Gardens",
    venue_address: "Langata",
    start_at: "2026-10-01T18:00:00.000Z",
    end_at: "2026-10-01T22:00:00.000Z",
    price: 0,
    currency: "KES",
    image_url: "https://example.com/k.jpg",
    booking_url: "https://example.com/book",
    source_url: "https://example.com/source",
    organizer_name: "SafariPlug",
    organizer_contact: "SECRET-WHATSAPP",
    submitted_by: "user-1",
    ai_confidence: 0.91,
    source_type: "AI_SCOUT",
    is_featured: true,
    verified: true,
    status: "approved",
    city: "Nairobi",
    city_id: "11111111-1111-1111-1111-111111111111",
    cities: { id: "11111111-1111-1111-1111-111111111111", name: "Nairobi", country: "Kenya" },
  });
  assert.ok(payload);
  assert.equal(payload?.source, "SafariPlug");
  assert.equal(payload?.safariplug_event_id, APPROVED_ID);
  assert.equal(payload?.destination, "Nairobi");
  assert.equal(payload?.status, "approved");
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("SECRET-WHATSAPP"), false);
  assert.equal(serialized.includes("organizer_contact"), false);
  assert.equal(serialized.includes("AI_SCOUT"), false);
  assert.equal(mapEventToAurelianExperience({
    id: APPROVED_ID,
    title: "Hidden",
    status: "pending",
  }), null);
});

test("adapter does not invent outbound HTTP calls", async () => {
  delete process.env.AURELIAN_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => {
    called += 1;
    return new Response("nope", { status: 500 });
  }) as typeof fetch;
  try {
    const health = await healthCheck();
    const sync = await syncExperience({
      source: "SafariPlug",
      safariplug_event_id: APPROVED_ID,
      title: "Festivals Kaleidoscope",
      description: null,
      category: null,
      destination: "Nairobi",
      city: { id: null, name: "Nairobi", country: "Kenya" },
      venue_name: null,
      venue_address: null,
      start_at: null,
      end_at: null,
      price: null,
      currency: null,
      image_url: null,
      source_url: null,
      booking_url: null,
      organizer_name: null,
      verified: false,
      is_featured: false,
      status: "approved",
    });
    assert.equal(health.ok, false);
    assert.equal(sync.ok, false);
    if (!health.ok) assert.equal(health.code === "not_configured" || health.code === "contract_required", true);
    assert.equal(called, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sync records not_configured instead of fabricating success", async () => {
  delete process.env.AURELIAN_API_BASE_URL;
  const upserts: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return Promise.resolve({
            data:
              table === "events"
                ? [
                    {
                      id: APPROVED_ID,
                      title: "Festivals Kaleidoscope",
                      status: "approved",
                      city: "Nairobi",
                    },
                    {
                      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                      title: "Pending should skip",
                      status: "pending",
                    },
                  ]
                : [],
            error: null,
          });
        },
        upsert(row: Record<string, unknown>) {
          upserts.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const summary = await syncApprovedExperiences(client as never);
  assert.equal(summary.success, true);
  assert.equal(summary.outbound.available, false);
  assert.equal(summary.synced, 0);
  assert.equal(summary.mapped, 1);
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].sync_status, "not_configured");
  assert.equal(upserts[0].provider, "aurelian");
  assert.equal(JSON.stringify(summary).includes("SAFARIPLUG_AURELIAN_API_KEY"), false);
});
