import assert from "node:assert/strict";
import { test } from "node:test";
import type { CatalogEvent } from "../models/event";
import { destinationCover, excludeById, firstCatalogImage } from "./dedupe";

function event(id: string, title: string, extras: Partial<CatalogEvent> = {}): CatalogEvent {
  return {
    id,
    title,
    description: null,
    category: "Music",
    start_at: null,
    end_at: null,
    venue_name: null,
    venue_address: null,
    price: null,
    currency: null,
    image_url: null,
    booking_url: null,
    organizer_name: null,
    is_featured: false,
    status: "approved",
    city: { id: "city", name: "Nairobi", country: "Kenya" },
    ...extras,
  };
}

test("happening soon excludes featured ids", () => {
  const a = event("11111111-1111-4111-8111-111111111111", "A");
  const b = event("22222222-2222-4222-8222-222222222222", "B");
  assert.deepEqual(excludeById([a, b], [a]).map((row) => row.id), [b.id]);
});

test("destination cover uses a real event image, never a fake url", () => {
  const events = [
    event("11111111-1111-4111-8111-111111111111", "A", {
      city: { id: "c", name: "Watamu", country: "Kenya" },
      image_url: "https://cdn.example/watamu.jpg",
    }),
  ];
  assert.equal(destinationCover("Watamu", events), "https://cdn.example/watamu.jpg");
  assert.equal(destinationCover("Nairobi", events), null);
  assert.equal(firstCatalogImage(events), "https://cdn.example/watamu.jpg");
});
