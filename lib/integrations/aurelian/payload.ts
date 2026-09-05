/**
 * Maps a SafariPlug events row to the Aurelian-facing inventory payload.
 * Field names follow the existing inbound pull contract
 * GET /api/integrations/aurelian/events plus additional columns that
 * already exist on public.events. No invented Aurelian-only fields.
 */

export const AURELIAN_EVENT_SELECT =
  "id, title, description, category, venue_name, venue_address, start_at, end_at, price, currency, image_url, booking_url, source_url, organizer_name, is_featured, verified, status, city_id, cities(id, name, country)";

export type AurelianExperiencePayload = {
  source: "SafariPlug";
  safariplug_event_id: string;
  title: string;
  description: string | null;
  category: string | null;
  destination: string | null;
  city: {
    id: string | null;
    name: string | null;
    country: string | null;
  } | null;
  venue_name: string | null;
  venue_address: string | null;
  start_at: string | null;
  end_at: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  source_url: string | null;
  booking_url: string | null;
  organizer_name: string | null;
  verified: boolean;
  is_featured: boolean;
  status: "approved";
};

type CityEmbed = {
  id?: string | null;
  name?: string | null;
  country?: string | null;
};

export type SafariPlugEventRow = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  venue_name?: unknown;
  venue_address?: unknown;
  start_at?: unknown;
  end_at?: unknown;
  price?: unknown;
  currency?: unknown;
  image_url?: unknown;
  booking_url?: unknown;
  source_url?: unknown;
  organizer_name?: unknown;
  organizer_contact?: unknown;
  is_featured?: unknown;
  verified?: unknown;
  status?: unknown;
  city_id?: unknown;
  cities?: CityEmbed | CityEmbed[] | null;
  submitted_by?: unknown;
  ai_confidence?: unknown;
  source_type?: unknown;
};

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cityFromRow(row: SafariPlugEventRow): AurelianExperiencePayload["city"] {
  const cities = row.cities;
  const embed = Array.isArray(cities) ? cities[0] : cities;
  const name = asString(embed?.name);
  const id = asString(embed?.id) || asString(row.city_id);
  const country = asString(embed?.country);
  if (!name && !id) return null;
  return { id, name, country };
}

export function mapEventToAurelianExperience(
  input: unknown
): AurelianExperiencePayload | null {
  if (!input || typeof input !== "object") return null;
  const row = input as SafariPlugEventRow;
  const id = asString(row.id);
  const title = asString(row.title);
  if (!id || !title) return null;
  if (row.status !== "approved") return null;

  const city = cityFromRow(row);

  return {
    source: "SafariPlug",
    safariplug_event_id: id,
    title,
    description: asString(row.description),
    category: asString(row.category),
    destination: city?.name ?? null,
    city,
    venue_name: asString(row.venue_name),
    venue_address: asString(row.venue_address),
    start_at: asString(row.start_at),
    end_at: asString(row.end_at),
    price: asNumber(row.price),
    currency: asString(row.currency),
    image_url: asString(row.image_url),
    source_url: asString(row.source_url),
    booking_url: asString(row.booking_url),
    organizer_name: asString(row.organizer_name),
    verified: Boolean(row.verified),
    is_featured: Boolean(row.is_featured),
    status: "approved",
  };
}
