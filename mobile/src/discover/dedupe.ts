import type { CatalogEvent } from "../models/event";

export function excludeById(events: CatalogEvent[], exclude: CatalogEvent[]): CatalogEvent[] {
  const ids = new Set(exclude.map((row) => row.id));
  return events.filter((row) => !ids.has(row.id));
}

export function firstCatalogImage(events: CatalogEvent[]): string | null {
  for (const event of events) {
    if (event.image_url) return event.image_url;
  }
  return null;
}

export function destinationCover(
  destinationName: string,
  events: CatalogEvent[]
): string | null {
  const match = events.find(
    (event) => event.city?.name === destinationName && Boolean(event.image_url)
  );
  return match?.image_url ?? null;
}
