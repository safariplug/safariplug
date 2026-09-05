import type {
  CatalogCity,
  CatalogDestination,
  CatalogEvent,
} from "../models/event";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asCity(value: unknown): CatalogCity | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const name = asString(raw.name);
  const id = asString(raw.id);
  const country = asString(raw.country);
  if (!name && !id) return null;
  return { id, name, country };
}

export function mapCatalogEvent(input: unknown): CatalogEvent | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const id = asString(raw.id);
  const title = asString(raw.title);
  if (!id || !title || !UUID_RE.test(id)) return null;
  if (raw.status !== "approved") return null;

  const image = asString(raw.image_url);
  const booking = asString(raw.booking_url);

  return {
    id,
    title,
    description: asString(raw.description),
    category: asString(raw.category),
    start_at: asString(raw.start_at),
    end_at: asString(raw.end_at),
    venue_name: asString(raw.venue_name),
    venue_address: asString(raw.venue_address),
    price: asNumber(raw.price),
    currency: asString(raw.currency),
    image_url: image,
    booking_url: booking,
    organizer_name: asString(raw.organizer_name),
    is_featured: Boolean(raw.is_featured),
    status: "approved",
    city: asCity(raw.city),
  };
}

export function mapCatalogEvents(input: unknown): CatalogEvent[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(mapCatalogEvent)
    .filter((row): row is CatalogEvent => row !== null);
}

export function mapDestination(input: unknown): CatalogDestination | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const id = asString(raw.id);
  const name = asString(raw.name);
  const slug = asString(raw.slug);
  if (!id || !name || !slug) return null;
  const count = asNumber(raw.event_count) ?? 0;
  return {
    id,
    name,
    country: asString(raw.country),
    slug,
    event_count: count < 0 ? 0 : count,
  };
}

export function mapDestinations(input: unknown): CatalogDestination[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(mapDestination)
    .filter((row): row is CatalogDestination => row !== null);
}

export function isEventId(value: string): boolean {
  return UUID_RE.test(value);
}

export function sanitizeSearchQuery(raw: string): string {
  return raw.replace(/[%_,.*()\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
