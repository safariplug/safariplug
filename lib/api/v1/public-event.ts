const PUBLIC_KEYS = [
  "id",
  "title",
  "description",
  "category",
  "start_at",
  "end_at",
  "venue_name",
  "venue_address",
  "price",
  "currency",
  "image_url",
  "booking_url",
  "organizer_name",
  "is_featured",
  "status",
  "city",
] as const;

export const PUBLIC_EVENT_SELECT =
  "id, title, description, category, venue_name, venue_address, start_at, end_at, price, currency, image_url, booking_url, organizer_name, is_featured, city, city_id, status, cities(id, name, country)";

export type PublicCity = {
  id: string | null;
  name: string | null;
  country: string | null;
};

export type PublicEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  start_at: string | null;
  end_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  booking_url: string | null;
  organizer_name: string | null;
  is_featured: boolean;
  status: "approved";
  city: PublicCity | null;
};

type CityEmbed = {
  id?: string | null;
  name?: string | null;
  country?: string | null;
};

type RawEvent = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  start_at?: unknown;
  end_at?: unknown;
  venue_name?: unknown;
  venue_address?: unknown;
  price?: unknown;
  currency?: unknown;
  image_url?: unknown;
  booking_url?: unknown;
  organizer_name?: unknown;
  is_featured?: unknown;
  status?: unknown;
  city?: unknown;
  city_id?: unknown;
  cities?: CityEmbed | CityEmbed[] | null;
  organizer_contact?: unknown;
  submitted_by?: unknown;
  ai_confidence?: unknown;
  source_type?: unknown;
  source_url?: unknown;
  verified?: unknown;
  verified_at?: unknown;
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

function embedCity(raw: RawEvent): PublicCity | null {
  const cities = raw.cities;
  const embed = Array.isArray(cities) ? cities[0] : cities;
  const name = asString(embed?.name) || asString(raw.city);
  const id = asString(embed?.id) || asString(raw.city_id);
  const country = asString(embed?.country);
  if (!name && !id) return null;
  return { id, name, country };
}

export function toPublicEvent(input: unknown): PublicEvent | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as RawEvent;
  const id = asString(raw.id);
  const title = asString(raw.title);
  if (!id || !title) return null;
  if (raw.status !== "approved") return null;

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
    image_url: asString(raw.image_url),
    booking_url: asString(raw.booking_url),
    organizer_name: asString(raw.organizer_name),
    is_featured: Boolean(raw.is_featured),
    status: "approved",
    city: embedCity(raw),
  };
}

export function assertNoPrivateFields(event: PublicEvent): void {
  const keys = Object.keys(event);
  for (const key of keys) {
    if (!PUBLIC_KEYS.includes(key as (typeof PUBLIC_KEYS)[number])) {
      throw new Error(`private field leaked: ${key}`);
    }
  }
}
