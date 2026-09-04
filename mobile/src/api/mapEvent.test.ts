import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPrice } from "../utils/format";
import {
  isEventId,
  mapCatalogEvent,
  mapCatalogEvents,
  sanitizeSearchQuery,
} from "./mapEvent";

const approved = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Sunset Safari",
  status: "approved",
  price: 4500,
  currency: "KES",
  image_url: "https://cdn.example/photo.jpg",
  booking_url: "https://partner.example/book",
  city: { id: "22222222-2222-4222-8222-222222222222", name: "Nairobi", country: "Kenya" },
};

test("maps approved public events and drops pending rows", () => {
  const event = mapCatalogEvent(approved);
  assert.equal(event?.title, "Sunset Safari");
  assert.equal(event?.status, "approved");
  assert.equal(event?.city?.name, "Nairobi");
  assert.equal(mapCatalogEvent({ ...approved, status: "pending" }), null);
  assert.equal(mapCatalogEvent({ ...approved, title: "" }), null);
});

test("missing price stays null so UI can show Price TBA", () => {
  const event = mapCatalogEvent({ ...approved, price: null, currency: null });
  assert.equal(event?.price, null);
  assert.equal(formatPrice(event?.price ?? null, event?.currency ?? null), "Price TBA");
  assert.equal(formatPrice(undefined, "KES"), "Price TBA");
  assert.notEqual(formatPrice(0, "KES"), "Price TBA");
});

test("missing image stays null rather than a fake url", () => {
  const event = mapCatalogEvent({ ...approved, image_url: "  " });
  assert.equal(event?.image_url, null);
  assert.equal(mapCatalogEvent({ ...approved, booking_url: "" })?.booking_url, null);
});

test("search query is bounded and stripped of ilike metacharacters", () => {
  assert.equal(sanitizeSearchQuery("  nairobi%_  "), "nairobi");
  assert.equal(sanitizeSearchQuery("a".repeat(100)).length, 80);
  assert.equal(sanitizeSearchQuery(""), "");
});

test("malformed payloads do not become fake events", () => {
  assert.deepEqual(mapCatalogEvents(null), []);
  assert.deepEqual(mapCatalogEvents([{ id: "x", title: "nope", status: "approved" }]), []);
  assert.equal(isEventId("not-a-uuid"), false);
  assert.equal(isEventId(approved.id), true);
});
