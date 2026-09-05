import { PAGE_SIZE } from "../config";
import type {
  CatalogDestination,
  CatalogEvent,
  CatalogExperienceCategory,
  CatalogExperienceCollection,
  EventListQuery,
} from "../models/event";
import { apiGet } from "./client";
import {
  isEventId,
  mapCatalogEvent,
  mapCatalogEvents,
  mapDestinations,
  sanitizeSearchQuery,
} from "./mapEvent";

export async function fetchEvents(query: EventListQuery = {}) {
  const result = await apiGet<unknown>("/events", {
    page: query.page ?? 1,
    limit: query.limit ?? PAGE_SIZE,
    city: query.city,
    category: query.category,
    featured: query.featured ? "true" : undefined,
    when: query.when ?? "valid",
  });
  return {
    events: mapCatalogEvents(result.data),
    page: result.meta?.page ?? query.page ?? 1,
    limit: result.meta?.limit ?? PAGE_SIZE,
    total: result.meta?.total ?? null,
  };
}

export async function fetchEvent(id: string): Promise<CatalogEvent> {
  if (!isEventId(id)) {
    throw new Error("Invalid event id.");
  }
  const result = await apiGet<unknown>(`/events/${id}`);
  const event = mapCatalogEvent(result.data);
  if (!event) {
    throw new Error("Event is not available.");
  }
  return event;
}

export async function searchEvents(q: string, page = 1) {
  const query = sanitizeSearchQuery(q);
  if (!query) {
    return { events: [] as CatalogEvent[], page: 1, total: 0, q: "" };
  }
  const result = await apiGet<unknown>("/search", {
    q: query,
    page,
    limit: PAGE_SIZE,
  });
  return {
    events: mapCatalogEvents(result.data),
    page: result.meta?.page ?? page,
    total: result.meta?.total ?? null,
    q: result.meta?.q ?? query,
  };
}

export async function fetchDestinations() {
  const result = await apiGet<unknown>("/destinations");
  return mapDestinations(result.data);
}

export async function fetchExperienceTaxonomy(): Promise<{
  collections: CatalogExperienceCollection[];
  categories: CatalogExperienceCategory[];
}> {
  const result = await apiGet<{
    collections?: unknown;
    categories?: unknown;
  }>("/experiences");
  const collections = Array.isArray(result.data.collections)
    ? result.data.collections.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const item = row as Record<string, unknown>;
        const slug = typeof item.slug === "string" ? item.slug : "";
        const name = typeof item.name === "string" ? item.name : "";
        if (!slug || !name) return [];
        return [
          {
            slug,
            name,
            description:
              typeof item.description === "string" ? item.description : "",
          },
        ];
      })
    : [];
  const categories = Array.isArray(result.data.categories)
    ? result.data.categories.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const item = row as Record<string, unknown>;
        const name = typeof item.name === "string" ? item.name : "";
        const count =
          typeof item.count === "number" && Number.isFinite(item.count)
            ? item.count
            : 0;
        if (!name) return [];
        return [{ name, count }];
      })
    : [];
  return { collections, categories };
}
